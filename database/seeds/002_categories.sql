-- Seed: categories
-- Standard Maharashtra CAP admission category codes.
-- Verify this list against the current year's official CAP
-- brochure before go-live — category codes/names are set by
-- the state and can be revised.

insert into categories (code, name, is_special, display_order) values
  ('OPEN',    'Open',                                false, 1),
  ('OBC',     'Other Backward Class',                 false, 2),
  ('SC',      'Scheduled Caste',                      false, 3),
  ('ST',      'Scheduled Tribe',                      false, 4),
  ('VJ',      'Vimukta Jati',                          false, 5),
  ('NT1',     'Nomadic Tribe 1',                       false, 6),
  ('NT2',     'Nomadic Tribe 2',                       false, 7),
  ('NT3',     'Nomadic Tribe 3',                       false, 8),
  ('SBC',     'Special Backward Class',                false, 9),
  ('EWS',     'Economically Weaker Section',           true,  10),
  ('TFWS',    'Tuition Fee Waiver Scheme',             true,  11),
  ('PWD',     'Persons with Disability',               true,  12),
  ('DEFENCE', 'Defence',                               true,  13),
  ('MI',      'Minority',                              true,  14),
  ('ORPHAN',  'Orphan',                                true,  15)
on conflict (code) do nothing;
