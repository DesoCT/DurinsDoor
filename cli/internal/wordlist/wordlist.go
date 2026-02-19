// Package wordlist provides a 256-entry Tolkien-themed word list used to produce
// human-verifiable ECDH confirmation phrases.
//
// Usage: index a byte value (0–255) to get the corresponding word.
// First 3 bytes of SHA-256(sharedSecret) → three words → verification phrase.
package wordlist

import (
	"crypto/rand"
	"strings"
)

// Words is indexed by a single byte (0–255).
var Words = [256]string{
	// 0–59: Places in Middle-earth
	"Shire", "Gondor", "Rohan", "Mordor", "Rivendell",
	"Lothlorien", "Moria", "Isengard", "Fangorn", "Hobbiton",
	"Valinor", "Numenor", "Edoras", "Mirkwood", "Erebor",
	"Bree", "Osgiliath", "Pelennor", "Anduin", "Weathertop",
	"Gondolin", "Nargothrond", "Doriath", "Beleriand", "Angband",
	"Thangorodrim", "Helmsdeep", "Orthanc", "Baraddur", "Dolguldur",
	"Gorgoroth", "Pelargir", "Dunharrow", "Hornburg", "Eregion",
	"Gladden", "Entwash", "Caradhras", "Zirakzigil", "Celebdil",
	"Lindon", "Evendim", "Buckland", "Bywater", "Crickhollow",
	"Bucklebury", "Harad", "Rhun", "Umbar", "Emynmuil",
	"Forodwaith", "Rhosgobel", "Khand", "Ithilien", "Anorien",
	"Calenardhon", "Lebennin", "Harlindon", "Forlindon", "Weatherhill",

	// 60–99: Characters from The Lord of the Rings
	"Aragorn", "Frodo", "Gandalf", "Legolas", "Gimli",
	"Boromir", "Faramir", "Theoden", "Eowyn", "Eomer",
	"Elrond", "Galadriel", "Saruman", "Sauron", "Shelob",
	"Gollum", "Bilbo", "Samwise", "Meriadoc", "Peregrin",
	"Treebeard", "Glorfindel", "Celeborn", "Haldir", "Arwen",
	"Eorl", "Denethor", "Shadowfax", "Quickbeam", "Beregond",
	"Cirdan", "Grima", "Smeagol", "Goldberry", "Bombadil",
	"Radagast", "Butterbur", "Thalion", "Ungoliant", "Gothmog",

	// 100–139: Characters from The Silmarillion
	"Earendil", "Fingolfin", "Hurin", "Turin", "Luthien",
	"Beren", "Melian", "Thingol", "Feanor", "Celebrimbor",
	"Maedhros", "Maglor", "Finrod", "Turgon", "Glaurung",
	"Ancalagon", "Morgoth", "Dior", "Idril", "Tuor",
	"Voronwe", "Ecthelion", "Beleg", "Mablung", "Morwen",
	"Nienor", "Barahir", "Huan", "Carcharoth", "Aredhel",
	"Celegorm", "Curufin", "Orodreth", "Caranthir", "Amrod",
	"Amras", "Angrod", "Aegnor", "Rian", "Emeldir",

	// 140–159: Second and Third Age figures
	"Elwing", "Elured", "Elurin", "Nimloth", "Elendil",
	"Isildur", "Anarion", "Amandil", "Borondir", "Cirion",
	"Gilraen", "Erestor", "Azaghal", "Ulfang", "Brodda",
	"Saeros", "Mim", "Brandir", "Gwindor", "Salgant",

	// 160–179: Valar and Maiar
	"Manwe", "Varda", "Ulmo", "Aule", "Yavanna",
	"Mandos", "Orome", "Tulkas", "Nessa", "Nienna",
	"Olorin", "Curunir", "Aiwendil", "Alatar", "Pallando",
	"Irmo", "Vaire", "Vana", "Este", "Melkor",

	// 180–206: Artefacts, weapons, and objects
	"Mithril", "Silmaril", "Palantir", "Anduril", "Narsil",
	"Glamdring", "Orcrist", "Sting", "Nenya", "Narya",
	"Vilya", "Phial", "Lembas", "Miruvor", "Herugrim",
	"Aeglos", "Gurthang", "Ringil", "Grond", "Durinsbane",
	"Elendilmir", "Nauglamir", "Galvorn", "Elessar", "Arkenstone",
	"Evenstar", "Ringbearer",

	// 207–255: Races, creatures, languages, and Hobbit names
	"Nazgul", "Watcher", "Warg", "Mumakil", "Huorn",
	"Noldor", "Sindar", "Vanyar", "Dunedain", "Rohirrim",
	"Haradrim", "Urukhai", "Quenya", "Sindarin", "Tengwar",
	"Cirth", "Ithildin", "Namarie", "Elbereth", "Gilthoniel",
	"Tinuviel", "Balrog", "Hobbit", "Dwarf", "Ringwraith",
	"Barrowwight", "Ent", "Istari", "Troll", "Dragon",
	"Dunlending", "Easterling", "Corsair", "Beorning", "Halfelven",
	"Gamgee", "Brandybuck", "Tookland", "Baggins", "Proudfoot",
	"Drogo", "Lobelia", "Primula", "Filibert", "Sandyman",
	"Bracegirdle", "Goodbody", "Bolger", "Wormtongue",
}

// GenerateCode picks a single random word from the list and returns it
// uppercased — e.g. "GANDALF". Used as the handshake pairing code.
func GenerateCode() (string, error) {
	b := make([]byte, 1)
	if _, err := rand.Read(b); err != nil {
		return "", err
	}
	return strings.ToUpper(Words[b[0]]), nil
}

// Phrase returns three words for the given bytes, joined by spaces.
// Typical usage: Phrase(sha256Hash[0], sha256Hash[1], sha256Hash[2])
func Phrase(a, b, c byte) string {
	return Words[a] + " " + Words[b] + " " + Words[c]
}
