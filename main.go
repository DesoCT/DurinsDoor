package main

import (
	"embed"

	"github.com/unisoniq/durins-door/cmd"
)

//go:embed web/templates web/static
var webFS embed.FS

func main() {
	cmd.SetWebFS(webFS)
	cmd.Execute()
}
