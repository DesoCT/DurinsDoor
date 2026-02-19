/**
 * 256 Tolkien-universe words for verification phrases.
 * Derived from the shared ECDH secret hash bytes[0..2] → 3 words.
 */
export const TOLKIEN_WORDS: string[] = [
  'Mithril', 'Shire', 'Gondor', 'Rohan', 'Mordor', 'Rivendell', 'Lothlórien', 'Erebor',
  'Mirkwood', 'Fangorn', 'Isengard', 'Edoras', 'Minas', 'Tirith', 'Orthanc', 'Cirith',
  'Ungol', 'Osgiliath', 'Helms', 'Deep', 'Pelennor', 'Amon', 'Hen', 'Anduin',
  'Misty', 'Mountains', 'Caradhras', 'Khazad', 'Dum', 'Moria', 'Barad', 'Dur',
  'Lugburz', 'Orodruin', 'Sammath', 'Naur', 'Weathertop', 'Amon', 'Sul', 'Bree',
  'Prancing', 'Pony', 'Mathom', 'Hobbiton', 'Bywater', 'Tuckborough', 'Brandywine', 'Michel',
  'Delving', 'Crickhollow', 'Farmer', 'Maggot', 'Green', 'Dragon', 'Eastfarthing', 'Westfarthing',
  'Northfarthing', 'Southfarthing', 'Overhill', 'Underhill', 'Bag', 'Bilbo', 'Frodo', 'Samwise',
  'Meriadoc', 'Peregrin', 'Gandalf', 'Saruman', 'Sauron', 'Aragorn', 'Legolas', 'Gimli',
  'Boromir', 'Faramir', 'Eowyn', 'Eomer', 'Theoden', 'Galadriel', 'Celeborn', 'Elrond',
  'Arwen', 'Glorfindel', 'Haldir', 'Treebeard', 'Quickbeam', 'Radagast', 'Bombadil', 'Goldberry',
  'Shelob', 'Balrog', 'Nazgul', 'Ringwraith', 'Uruk', 'Hai', 'Orc', 'Goblin',
  'Warg', 'Dragon', 'Smaug', 'Glaurung', 'Ancalagon', 'Scatha', 'Chrysophylax', 'Mumak',
  'Ent', 'Huorn', 'Eagle', 'Raven', 'Crebain', 'Fell', 'Beast', 'Watcher',
  'Ungoliant', 'Draugluin', 'Carcharoth', 'Tevildo', 'Huan', 'Shadowfax', 'Asfaloth', 'Hasufel',
  'Arod', 'Bill', 'Pony', 'Silverfoot', 'Nahar', 'Elvish', 'Quenya', 'Sindarin',
  'Westron', 'Khuzdul', 'Entish', 'Adunaic', 'Valarin', 'Tengwar', 'Cirth', 'Sarati',
  'Ithildin', 'Palantir', 'Silmaril', 'Arkenstone', 'Narsil', 'Anduril', 'Glamdring', 'Orcrist',
  'Sting', 'Herugrim', 'Grond', 'Ringil', 'Gurthang', 'Anglachel', 'Aeglos', 'Belthronding',
  'Narya', 'Nenya', 'Vilya', 'Annatar', 'Celebrimbor', 'Feanor', 'Morgoth', 'Melkor',
  'Manwe', 'Varda', 'Ulmo', 'Yavanna', 'Aule', 'Mandos', 'Nienna', 'Orome',
  'Namo', 'Irmo', 'Tulkas', 'Nessa', 'Vana', 'Este', 'Vaire', 'Vaire',
  'Earendil', 'Elwing', 'Tuor', 'Idril', 'Beren', 'Luthien', 'Thingol', 'Melian',
  'Turin', 'Nienor', 'Mim', 'Beleg', 'Hurin', 'Morwen', 'Glorfindel', 'Ecthelion',
  'Gothmog', 'Fingolfin', 'Finarfin', 'Maedhros', 'Maglor', 'Celegorm', 'Caranthir', 'Curufin',
  'Amrod', 'Amras', 'Finrod', 'Orodreth', 'Angrod', 'Aegnor', 'Galadriel', 'Gil',
  'Galad', 'Celebrimbor', 'Elwe', 'Olwe', 'Ingwe', 'Finwe', 'Miriel', 'Indis',
  'Earwen', 'Anaire', 'Lalwen', 'Aredhel', 'Maeglin', 'Eol', 'Isfin', 'Glorfindel',
  'Turgon', 'Gondolin', 'Nargothrond', 'Doriath', 'Brethil', 'Estolad', 'Thargelion', 'Dor',
  'Lomin', 'Hithlum', 'Nevrast', 'Sirion', 'Narog', 'Teiglin', 'Esgalduin', 'Gelion',
  'Ascar', 'Ossiriand', 'Taur', 'Duin', 'Nan', 'Elmoth', 'Taeglin', 'Cabed',
]

// Pad/truncate to exactly 256
while (TOLKIEN_WORDS.length < 256) {
  TOLKIEN_WORDS.push(`Rune${TOLKIEN_WORDS.length}`)
}

/**
 * Derive a 3-word Tolkien verification phrase from a CryptoKey (shared secret).
 * Both sides of a handshake should produce the same phrase if they derived the same key.
 */
export async function deriveVerificationPhrase(sharedKey: CryptoKey): Promise<string> {
  const raw = await crypto.subtle.exportKey('raw', sharedKey)
  const hash = await crypto.subtle.digest('SHA-256', raw)
  const bytes = new Uint8Array(hash)
  return [
    TOLKIEN_WORDS[bytes[0]],
    TOLKIEN_WORDS[bytes[1]],
    TOLKIEN_WORDS[bytes[2]],
  ].join(' · ')
}
