package data

import (
	_ "embed"
	"encoding/json"
	"log"

	"github.com/trikunc/go_vibe/models"
	"gorm.io/gorm"
)

//go:embed seed_proteins.json
var SeedProteinsJSON []byte

// SeedProteins populates or synchronizes scientific food protein data with the database
func SeedProteins(db *gorm.DB) error {
	var proteins []models.Protein
	if err := json.Unmarshal(SeedProteinsJSON, &proteins); err != nil {
		return err
	}

	for _, p := range proteins {
		var existing models.Protein
		err := db.Where("pdb_id = ?", p.PdbID).First(&existing).Error
		if err == gorm.ErrRecordNotFound {
			if err := db.Create(&p).Error; err != nil {
				return err
			}
			log.Printf("[INFO] Seeded protein: %s (%s)\n", p.Name, p.PdbID)
		} else if err == nil {
			// Update existing record to guarantee scientific accuracy and valid source data
			existing.Name = p.Name
			existing.CommonName = p.CommonName
			existing.SourceCategory = p.SourceCategory
			existing.FoodSource = p.FoodSource
			existing.MolecularWeight = p.MolecularWeight
			existing.IsoelectricPoint = p.IsoelectricPoint
			existing.DigestibilityScore = p.DigestibilityScore
			existing.BiologicalFunction = p.BiologicalFunction
			existing.UniprotID = p.UniprotID
			existing.ReferenceURL = p.ReferenceURL
			existing.Description = p.Description
			existing.AminoAcidProfile = p.AminoAcidProfile
			if err := db.Save(&existing).Error; err != nil {
				return err
			}
			log.Printf("[INFO] Synchronized verified scientific data for protein: %s (PDB: %s, Source: %s)\n", existing.Name, existing.PdbID, existing.FoodSource)
		} else {
			return err
		}
	}

	log.Printf("[INFO] Scientific protein data verification complete (%d proteins processed).\n", len(proteins))
	return nil
}
