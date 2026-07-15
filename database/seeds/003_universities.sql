-- Seed: universities
-- Major Maharashtra affiliating universities relevant to MCA
-- colleges. Extend via the Admin Panel (Phase 9) as needed —
-- this is a starting set, not exhaustive.

insert into universities (name, short_name, region) values
  ('University of Mumbai',                                   'MU',      'Mumbai'),
  ('Savitribai Phule Pune University',                       'SPPU',    'Pune'),
  ('Shivaji University, Kolhapur',                            'SUK',     'Kolhapur'),
  ('Dr. Babasaheb Ambedkar Marathwada University',            'BAMU',    'Aurangabad'),
  ('Sant Gadge Baba Amravati University',                     'SGBAU',   'Amravati'),
  ('Rashtrasant Tukadoji Maharaj Nagpur University',          'RTMNU',   'Nagpur'),
  ('Dr. Babasaheb Ambedkar Technological University',        'DBATU',   'Lonere'),
  ('SRTM University, Nanded',                                 'SRTMUN',  'Nanded'),
  ('North Maharashtra University, Jalgaon',                   'NMU',     'Jalgaon'),
  ('Solapur University',                                      'SUS',     'Solapur')
on conflict (name) do nothing;
