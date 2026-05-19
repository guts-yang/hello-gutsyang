package content

import (
	_ "embed"
	"encoding/json"

	"github.com/guts-yang/hello-gutsyang/backend/internal/model"
)

//go:embed seed_data.json
var seedDataJSON []byte

func seedSnapshot() model.ContentSnapshot {
	var snap model.ContentSnapshot
	if err := json.Unmarshal(seedDataJSON, &snap); err != nil {
		panic("content: invalid seed_data.json: " + err.Error())
	}
	return snap
}
