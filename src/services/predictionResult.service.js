'use strict';

const predictionRepository = require('../repositories/prediction.repository');
const collegeRepository = require('../repositories/college.repository');
const placementRepository = require('../repositories/placement.repository');
const feeRepository = require('../repositories/fee.repository');
const { generateRoundCodes } = require('../utils/constants');
const { shouldShowInVeryHigh } = require('../config/veryHighDisplayThresholds');
const { shouldShowInLow } = require('../config/lowDisplayMargin');
const { getAspirationalCountForExam } = require('../config/preferenceOrderConfig');

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
 * Builds the "Recommended Preference Order" using an actual CAP
 * counselling strategy, instead of the engine's own generic
 * ordering — a DISPLAY-layer concern only. Does not touch the
 * engine, chance classification, or anything stored in the
 * prediction's result_snapshot; this is computed fresh every
 * time a result is viewed, from Round 1's already-filtered,
 * already-sorted bucket data (see applyDisplayFilterAndSort
 * above, which must run first).
 *
 * Structure, exactly as specified:
 *   1. Aspirational — the N colleges (configurable, see
 *      src/config/preferenceOrderConfig.js) with the highest
 *      cutoffs overall, regardless of chance band. Already
 *      scoped to the student's Admission University, since the
 *      engine's own candidate pool is already filtered to that
 *      university (see predictionEngine.service.js).
 *   2. Moderate Chance — every remaining Moderate college.
 *   3. High Chance — every remaining High college.
 *   4. Very High Chance — every remaining Very High college.
 * Each section sorted by cutoff descending. Low Chance colleges
 * are deliberately excluded from the list entirely, unless one
 * happens to be an Aspirational pick — a smart CAP preference
 * list prioritizes realistic safety nets over many low-odds
 * options, matching how an experienced counsellor would build one.
 *
 * No college appears twice: once picked for Aspirational, it's
 * removed from wherever it would have otherwise landed.
 */
function buildStrategicPreferenceOrder(snapshot, examTypeCode) {
  const roundCodes = snapshot.roundCodes || generateRoundCodes(4);
  const firstRound = snapshot.rounds[roundCodes[0]];
  if (!firstRound) {
    return [];
  }

  // Combine every chance bucket into one list, each entry tagged
  // with which bucket it truly belongs to (its real chance) —
  // needed both to route it into the right section below, and so
  // the view can still show a college's genuine chance even when
  // it's promoted into the Aspirational section.
  const combined = [];
  for (const bucketKey of CHANCE_BUCKET_KEYS) {
    for (const entry of firstRound[bucketKey] || []) {
      combined.push({ ...entry, originalBucket: bucketKey });
    }
  }

  const aspirationalCount = getAspirationalCountForExam(examTypeCode);
  const sortedByCutoffDesc = [...combined].sort((a, b) => b.cutoffPercentile - a.cutoffPercentile);
  const aspirational = sortedByCutoffDesc.slice(0, aspirationalCount);
  const aspirationalIds = new Set(aspirational.map((entry) => entry.collegeId));

  const remaining = combined.filter((entry) => !aspirationalIds.has(entry.collegeId));
  const sectionEntries = (bucketKey) =>
    remaining.filter((entry) => entry.originalBucket === bucketKey).sort((a, b) => b.cutoffPercentile - a.cutoffPercentile);

  const ordered = [
    ...aspirational.map((entry) => ({ ...entry, section: 'aspirational' })),
    ...sectionEntries('moderate').map((entry) => ({ ...entry, section: 'moderate' })),
    ...sectionEntries('high').map((entry) => ({ ...entry, section: 'high' })),
    ...sectionEntries('veryHigh').map((entry) => ({ ...entry, section: 'veryHigh' })),
  ];

  return ordered.map((entry, index) => ({ ...entry, rank: index + 1 }));
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

  // Replaces the engine's own recommendedPreferenceOrder with the
  // new counselling-strategy structure, computed fresh for
  // display — the engine's actual stored result_snapshot in the
  // database is never touched, only this in-memory copy used for
  // rendering this one request.
  snapshot.recommendedPreferenceOrder = buildStrategicPreferenceOrder(snapshot, snapshot.examTypeCode);

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