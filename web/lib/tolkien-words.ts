/**
 * 256 Tolkien-universe words for verification phrases.
 * This list MUST match the Go wordlist at internal/wordlist/wordlist.go exactly.
 * Derived from SHA-256(raw ECDH shared secret) bytes[0..2] → 3 words.
 */
export const TOLKIEN_WORDS: string[] = [
  // 0-59: Places in Middle-earth
  'Shire', 'Gondor', 'Rohan', 'Mordor', 'Rivendell',
  'Lothlorien', 'Moria', 'Isengard', 'Fangorn', 'Hobbiton',
  'Valinor', 'Numenor', 'Edoras', 'Mirkwood', 'Erebor',
  'Bree', 'Osgiliath', 'Pelennor', 'Anduin', 'Weathertop',
  'Gondolin', 'Nargothrond', 'Doriath', 'Beleriand', 'Angband',
  'Thangorodrim', 'Helmsdeep', 'Orthanc', 'Baraddur', 'Dolguldur',
  'Gorgoroth', 'Pelargir', 'Dunharrow', 'Hornburg', 'Eregion',
  'Gladden', 'Entwash', 'Caradhras', 'Zirakzigil', 'Celebdil',
  'Lindon', 'Evendim', 'Buckland', 'Bywater', 'Crickhollow',
  'Bucklebury', 'Harad', 'Rhun', 'Umbar', 'Emynmuil',
  'Forodwaith', 'Rhosgobel', 'Khand', 'Ithilien', 'Anorien',
  'Calenardhon', 'Lebennin', 'Harlindon', 'Forlindon', 'Weatherhill',

  // 60-99: Characters from The Lord of the Rings
  'Aragorn', 'Frodo', 'Gandalf', 'Legolas', 'Gimli',
  'Boromir', 'Faramir', 'Theoden', 'Eowyn', 'Eomer',
  'Elrond', 'Galadriel', 'Saruman', 'Sauron', 'Shelob',
  'Gollum', 'Bilbo', 'Samwise', 'Meriadoc', 'Peregrin',
  'Treebeard', 'Glorfindel', 'Celeborn', 'Haldir', 'Arwen',
  'Eorl', 'Denethor', 'Shadowfax', 'Quickbeam', 'Beregond',
  'Cirdan', 'Grima', 'Smeagol', 'Goldberry', 'Bombadil',
  'Radagast', 'Butterbur', 'Thalion', 'Ungoliant', 'Gothmog',

  // 100-139: Characters from The Silmarillion
  'Earendil', 'Fingolfin', 'Hurin', 'Turin', 'Luthien',
  'Beren', 'Melian', 'Thingol', 'Feanor', 'Celebrimbor',
  'Maedhros', 'Maglor', 'Finrod', 'Turgon', 'Glaurung',
  'Ancalagon', 'Morgoth', 'Dior', 'Idril', 'Tuor',
  'Voronwe', 'Ecthelion', 'Beleg', 'Mablung', 'Morwen',
  'Nienor', 'Barahir', 'Huan', 'Carcharoth', 'Aredhel',
  'Celegorm', 'Curufin', 'Orodreth', 'Caranthir', 'Amrod',
  'Amras', 'Angrod', 'Aegnor', 'Rian', 'Emeldir',

  // 140-159: Second and Third Age figures
  'Elwing', 'Elured', 'Elurin', 'Nimloth', 'Elendil',
  'Isildur', 'Anarion', 'Amandil', 'Borondir', 'Cirion',
  'Gilraen', 'Erestor', 'Azaghal', 'Ulfang', 'Brodda',
  'Saeros', 'Mim', 'Brandir', 'Gwindor', 'Salgant',

  // 160-179: Valar and Maiar
  'Manwe', 'Varda', 'Ulmo', 'Aule', 'Yavanna',
  'Mandos', 'Orome', 'Tulkas', 'Nessa', 'Nienna',
  'Olorin', 'Curunir', 'Aiwendil', 'Alatar', 'Pallando',
  'Irmo', 'Vaire', 'Vana', 'Este', 'Melkor',

  // 180-206: Artefacts, weapons, and objects
  'Mithril', 'Silmaril', 'Palantir', 'Anduril', 'Narsil',
  'Glamdring', 'Orcrist', 'Sting', 'Nenya', 'Narya',
  'Vilya', 'Phial', 'Lembas', 'Miruvor', 'Herugrim',
  'Aeglos', 'Gurthang', 'Ringil', 'Grond', 'Durinsbane',
  'Elendilmir', 'Nauglamir', 'Galvorn', 'Elessar', 'Arkenstone',
  'Evenstar', 'Ringbearer',

  // 207-255: Races, creatures, languages, and Hobbit names
  'Nazgul', 'Watcher', 'Warg', 'Mumakil', 'Huorn',
  'Noldor', 'Sindar', 'Vanyar', 'Dunedain', 'Rohirrim',
  'Haradrim', 'Urukhai', 'Quenya', 'Sindarin', 'Tengwar',
  'Cirth', 'Ithildin', 'Namarie', 'Elbereth', 'Gilthoniel',
  'Tinuviel', 'Balrog', 'Hobbit', 'Dwarf', 'Ringwraith',
  'Barrowwight', 'Ent', 'Istari', 'Troll', 'Dragon',
  'Dunlending', 'Easterling', 'Corsair', 'Beorning', 'Halfelven',
  'Gamgee', 'Brandybuck', 'Tookland', 'Baggins', 'Proudfoot',
  'Drogo', 'Lobelia', 'Primula', 'Filibert', 'Sandyman',
  'Bracegirdle', 'Goodbody', 'Bolger', 'Wormtongue',
]

/**
 * Derive a 3-word Tolkien verification phrase from the raw ECDH shared secret.
 * Both sides of a handshake should produce the same phrase if they derived the same secret.
 *
 * Input: the raw 32-byte ECDH shared secret (NOT the derived AES key).
 */
export async function deriveVerificationPhrase(rawSecret: ArrayBuffer): Promise<string> {
  const hash = await crypto.subtle.digest('SHA-256', rawSecret)
  const bytes = new Uint8Array(hash)
  return [
    TOLKIEN_WORDS[bytes[0]],
    TOLKIEN_WORDS[bytes[1]],
    TOLKIEN_WORDS[bytes[2]],
  ].join(' · ')
}
