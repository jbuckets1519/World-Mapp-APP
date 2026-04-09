/**
 * The 193 UN member states plus Palestine (194 total).
 * Uses Natural Earth GeoJSON NAME values so polygon names can be looked up directly.
 * Includes common alternate names / abbreviations used by Natural Earth datasets.
 *
 * NOT included (territories / disputed / observer states):
 *   Kosovo, Taiwan, N. Cyprus, Somaliland, W. Sahara, Vatican,
 *   Puerto Rico, Greenland, New Caledonia, Falkland Is., French Southern
 *   and Antarctic Lands, Cayman Islands, Turks and Caicos, Bermuda,
 *   Guam, US Virgin Islands, British Virgin Islands, Aruba, Curaçao,
 *   French Polynesia, etc.
 */

export const TOTAL_UN_COUNTRIES = 194;

const UN_MEMBER_NAMES: readonly string[] = [
  // --- A ---
  'Afghanistan',
  'Albania',
  'Algeria',
  'Andorra',
  'Angola',
  'Antigua and Barbuda',
  'Antigua and Barb.',
  'Argentina',
  'Armenia',
  'Australia',
  'Austria',
  'Azerbaijan',

  // --- B ---
  'Bahamas',
  'The Bahamas',
  'Bahrain',
  'Bangladesh',
  'Barbados',
  'Belarus',
  'Belgium',
  'Belize',
  'Benin',
  'Bhutan',
  'Bolivia',
  'Bosnia and Herzegovina',
  'Bosnia and Herz.',
  'Botswana',
  'Brazil',
  'Brunei',
  'Brunei Darussalam',
  'Bulgaria',
  'Burkina Faso',
  'Burundi',

  // --- C ---
  'Cabo Verde',
  'Cape Verde',
  'Cambodia',
  'Cameroon',
  'Canada',
  'Central African Republic',
  'Central African Rep.',
  'Chad',
  'Chile',
  'China',
  'Colombia',
  'Comoros',
  'Congo',                                // Republic of the Congo
  'Republic of the Congo',
  'Dem. Rep. Congo',                      // Democratic Republic of the Congo
  'Democratic Republic of the Congo',
  'Costa Rica',
  "Côte d'Ivoire",
  'Ivory Coast',
  'Croatia',
  'Cuba',
  'Cyprus',
  'Czech Republic',
  'Czech Rep.',
  'Czechia',

  // --- D ---
  'Denmark',
  'Djibouti',
  'Dominica',
  'Dominican Republic',
  'Dominican Rep.',

  // --- E ---
  'Ecuador',
  'Egypt',
  'El Salvador',
  'Equatorial Guinea',
  'Eq. Guinea',
  'Eritrea',
  'Estonia',
  'eSwatini',
  'Swaziland',
  'Ethiopia',

  // --- F ---
  'Fiji',
  'Finland',
  'France',

  // --- G ---
  'Gabon',
  'Gambia',
  'The Gambia',
  'Georgia',
  'Germany',
  'Ghana',
  'Greece',
  'Grenada',
  'Guatemala',
  'Guinea',
  'Guinea-Bissau',
  'Guyana',

  // --- H ---
  'Haiti',
  'Honduras',
  'Hungary',

  // --- I ---
  'Iceland',
  'India',
  'Indonesia',
  'Iran',
  'Iraq',
  'Ireland',
  'Israel',
  'Italy',

  // --- J ---
  'Jamaica',
  'Japan',
  'Jordan',

  // --- K ---
  'Kazakhstan',
  'Kenya',
  'Kiribati',
  'North Korea',
  'South Korea',
  'Korea',
  'Kuwait',
  'Kyrgyzstan',

  // --- L ---
  'Laos',
  'Latvia',
  'Lebanon',
  'Lesotho',
  'Liberia',
  'Libya',
  'Liechtenstein',
  'Lithuania',
  'Luxembourg',

  // --- M ---
  'Madagascar',
  'Malawi',
  'Malaysia',
  'Maldives',
  'Mali',
  'Malta',
  'Marshall Islands',
  'Marshall Is.',
  'Mauritania',
  'Mauritius',
  'Mexico',
  'Micronesia',
  'Moldova',
  'Monaco',
  'Mongolia',
  'Montenegro',
  'Morocco',
  'Mozambique',
  'Myanmar',

  // --- N ---
  'Namibia',
  'Nauru',
  'Nepal',
  'Netherlands',
  'New Zealand',
  'Nicaragua',
  'Niger',
  'Nigeria',
  'North Macedonia',
  'Macedonia',
  'Norway',

  // --- O ---
  'Oman',

  // --- P ---
  'Pakistan',
  'Palau',
  'Palestine',
  'Panama',
  'Papua New Guinea',
  'Paraguay',
  'Peru',
  'Philippines',
  'Poland',
  'Portugal',

  // --- Q ---
  'Qatar',

  // --- R ---
  'Romania',
  'Russia',
  'Rwanda',

  // --- S ---
  'Saint Kitts and Nevis',
  'St. Kitts and Nevis',
  'Saint Lucia',
  'St. Lucia',
  'Saint Vincent and the Grenadines',
  'St. Vin. and Gren.',
  'Samoa',
  'San Marino',
  'São Tomé and Principe',
  'São Tomé and Príncipe',
  'Saudi Arabia',
  'Senegal',
  'Serbia',
  'Seychelles',
  'Sierra Leone',
  'Singapore',
  'Slovakia',
  'Slovenia',
  'Solomon Islands',
  'Solomon Is.',
  'Somalia',
  'South Africa',
  'South Sudan',
  'S. Sudan',
  'Spain',
  'Sri Lanka',
  'Sudan',
  'Suriname',
  'Sweden',
  'Switzerland',
  'Syria',

  // --- T ---
  'Tajikistan',
  'Tanzania',
  'United Republic of Tanzania',
  'Thailand',
  'Timor-Leste',
  'East Timor',
  'Togo',
  'Tonga',
  'Trinidad and Tobago',
  'Tunisia',
  'Turkey',
  'Türkiye',
  'Turkmenistan',
  'Tuvalu',

  // --- U ---
  'Uganda',
  'Ukraine',
  'United Arab Emirates',
  'United Kingdom',
  'United States of America',
  'United States',
  'Uruguay',
  'Uzbekistan',

  // --- V ---
  'Vanuatu',
  'Venezuela',
  'Vietnam',

  // --- Y ---
  'Yemen',

  // --- Z ---
  'Zambia',
  'Zimbabwe',
];

/** O(1) lookup — true if the name matches a UN member state */
const UN_MEMBERS = new Set<string>(UN_MEMBER_NAMES);

export function isUNMember(name: string): boolean {
  return UN_MEMBERS.has(name);
}
