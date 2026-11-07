package content

import (
    _ "embed"
    "encoding/json"
)

//go:embed seed.json
var seedBytes []byte

var Seed []Question

func init() {
    if err := json.Unmarshal(seedBytes, &Seed); err != nil {
        panic(err)
    }
}
