package handler

import (
	"log"
	"net/http"
	"sync"

	"github.com/gin-gonic/gin"
	"github.com/trikunc/go_vibe/config"
	"github.com/trikunc/go_vibe/data"
	"github.com/trikunc/go_vibe/models"
	"github.com/trikunc/go_vibe/routes"
)

var (
	engine *gin.Engine
	once   sync.Once
)

func initEngine() {
	gin.SetMode(gin.ReleaseMode)
	db, err := config.InitDB()
	if err != nil {
		log.Printf("[WARN] Vercel serverless InitDB: %v", err)
	} else {
		_ = db.AutoMigrate(&models.Protein{}, &models.User{})
		_ = data.SeedProteins(db)
	}
	engine = routes.SetupRouter(db)
}

// Handler is the entrypoint for Vercel Serverless Functions
func Handler(w http.ResponseWriter, r *http.Request) {
	once.Do(initEngine)
	if engine != nil {
		engine.ServeHTTP(w, r)
	} else {
		http.Error(w, "Failed to initialize serverless application", http.StatusInternalServerError)
	}
}
