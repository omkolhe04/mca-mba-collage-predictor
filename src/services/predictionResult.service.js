'use strict';

const predictionRepository = require('../repositories/prediction.repository');
const collegeRepository = require('../repositories/college.repository');
const placementRepository = require('../repositories/placement.repository');
const feeRepository = require('../repositories/fee.repository');
const { generateRoundCodes } = require('../utils/constants');
const { shouldShowInVeryHigh } = require('../config/veryHighDisplayThresholds');
const { shouldShowInLow } = require('../config/lowDisplayMargin');

const CHANCE_BUCKET_KEYS = ['veryHigh', 'high', 'moderate', 'low'];

/**
 * Every college id referenced anywhere in the snapshot — across
 * all rounds, all buckets, the dream college, and the
 * recommended preference order — so enrichment data can be
 * fetched in one bulk pass instead of per-card.
 *
 * Uses snapshot.roundCodes (set by the Prediction Engine at
 * computation time) rather than a hardcoded round list — this
 * snapshot might be for a 4-round exam (MCA CET), a 3-round exam
 * (MBA CET), or any other configured count. Predictions computed
 * before this field existed fall back to 4 rounds, matching what
 * the engine always produced at the time.
 */
function collectCollegeIds(snapshot) {
  const ids = new Set();
  const roundCodes = snapshot.roundCodes || generateRoundCodes(4);

  for (const roundCode of roundCodes) {
    const round = snapshot.rounds[roundCode];
    if (!round) continue;
    for (const bucketKey of CHANCE_BUCKET_KEYS) {
      for (const entry of round[bucketKey] || []) ids.add(entry.collegeId);
    }
    for (const entry of round.noData || []) ids.add(entry.collegeId);
  }

  if (snapshot.dreamCollege) {
    ids.add(snapshot.dreamCollege.collegeId);
  }
  for (const entry of snapshot.recommendedPreferenceOrder || []) {
    ids.add(entry.collegeId);
  }

  return Array.from(ids);
}

/**
 * Reduces a list of rows (already ordered most-recent-year
 * first) to a Map of collegeId -> most recent row.
 */
function latestByCollegeId(rows) {
  const map = new Map();
  for (const row of rows) {
    if (!map.has(row.college_id)) {
      map.set(row.college_id, row);
    }
  }
  return map;
}

/**
 * Applies DISPLAY-layer transformations to a snapshot's chance
 * buckets, in the exact order specified:
 *   1. Threshold/margin filters — Very High Chance uses
 *      src/config/veryHighDisplayThresholds.js (hides colleges
 *      whose cutoff is far below the student's percentile); Low
 *      Chance uses src/config/lowDisplayMargin.js (hides colleges
 *      whose cutoff is far above it — an unrealistic stretch).
 *      High and Moderate are never filtered.
 *   2. Re-sorts every chance category (Very High, High, Moderate,
 *      Low) by cutoff percentile descending — closest colleges
 *      to the student's own percentile shown first.
 *
 * Neither step touches classification, difference, or any other
 * computed value — a college's chance bucket and its difference
 * number are exactly what the engine computed; this only changes
 * which of them are shown and the order they're rendered in.
 * predictionEngine.service.js itself is completely untouched —
 * it still computes its own internal sort order too, which this
 * simply supersedes for display, rather than risking any change
 * to the engine file itself.
 *
 * `noData` and the Recommended Preference Order are explicitly
 * out of scope here and are left exactly as the engine produced
 * them.
 *
 * Returns a new object rather than mutating the input — the
 * caller (buildResultView) always uses this return value.
 */
function applyDisplayFilterAndSort(snapshot, studentPercentile) {
  const roundCodes = snapshot.roundCodes || generateRoundCodes(4);
  const filteredRounds = { ...snapshot.rounds };

  for (const roundCode of roundCodes) {
    const round = snapshot.rounds[roundCode];
    if (!round) continue;

    const newRound = { ...round };

    for (const bucketKey of CHANCE_BUCKET_KEYS) {
      if (!Array.isArray(round[bucketKey])) continue;

      let entries = round[bucketKey];
      if (bucketKey === 'veryHigh') {
        entries = entries.filter((entry) =>
          shouldShowInVeryHigh(studentPercentile, entry.cutoffPercentile, snapshot.examTypeCode)
        );
      } else if (bucketKey === 'low') {
        entries = entries.filter((entry) => shouldShowInLow(studentPercentile, entry.cutoffPercentile, snapshot.examTypeCode));
      }
      // Highest cutoff first — closest to the student's own
      // percentile, per the spec. A plain numeric sort, since
      // cutoffPercentile is always a number by this point.
      newRound[bucketKey] = [...entries].sort((a, b) => b.cutoffPercentile - a.cutoffPercentile);
    }

    filteredRounds[roundCode] = newRound;
  }

  return { ...snapshot, rounds: filteredRounds };
}

/**
 * Assembles everything the Result Page view needs: the
 * prediction, its engine snapshot, and a Map of collegeId ->
 * enrichment data (NAAC, autonomy, hostel, fee, placement).
 * Returns null if the prediction doesn't exist.
 */
async function buildResultView(predictionId) {
  const prediction = await predictionRepository.findById(predictionId);
  if (!prediction) {
    return null;
  }

  const rawSnapshot = prediction.result_snapshot;
  const hasSnapshot = rawSnapshot && typeof rawSnapshot === 'object' && rawSnapshot.engineVersion;

  if (!hasSnapshot || rawSnapshot.totalCollegesEvaluated === 0) {
    return { prediction, snapshot: hasSnapshot ? rawSnapshot : null, collegeDetails: new Map() };
  }

  const snapshot = applyDisplayFilterAndSort(rawSnapshot, Number(prediction.percentile));

  const collegeIds = collectCollegeIds(snapshot);

  const [details, placements, fees] = await Promise.all([
    collegeRepository.findDetailsByIds(collegeIds),
    placementRepository.findByCollegeIds(collegeIds),
    feeRepository.findStandardByCollegeIds(collegeIds),
  ]);

  const latestPlacement = latestByCollegeId(placements);
  const latestFee = latestByCollegeId(fees);

  const collegeDetails = new Map();
  for (const college of details) {
    const placement = latestPlacement.get(college.id);
    const fee = latestFee.get(college.id);

    collegeDetails.set(college.id, {
      naacGrade: college.naac_grade,
      autonomous: college.autonomous,
      hostelAvailable: college.hostel_available,
      websiteUrl: college.website_url,
      googleMapsUrl: college.google_maps_url,
      annualFee: fee ? Number(fee.annual_fee) : null,
      averagePackageLpa: placement ? Number(placement.average_package_lpa) : null,
      highestPackageLpa: placement ? Number(placement.highest_package_lpa) : null,
    });
  }

  return { prediction, snapshot, collegeDetails };
}

module.exports = { buildResultView };
