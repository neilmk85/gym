// cmd/posseed/main.go — seeds POS products with realistic gym-store inventory.
// Idempotent: skips products whose SKU already exists.
package main

import (
	"log/slog"
	"os"

	"gym-backend/internal/config"
	"gym-backend/internal/database"
	"gym-backend/internal/models"
)

type productDef struct {
	name        string
	sku         string
	category    string
	description string
	mrpPaise    int64
	pricePaise  int64
	costPaise   int64
	stockQty    int
	lowStockAt  int
}

func main() {
	logger := slog.New(slog.NewTextHandler(os.Stdout, &slog.HandlerOptions{Level: slog.LevelInfo}))

	cfg, err := config.Load()
	if err != nil {
		logger.Error("config load failed", "err", err)
		os.Exit(1)
	}
	db, err := database.Connect(&cfg.Database)
	if err != nil {
		logger.Error("db connect failed", "err", err)
		os.Exit(1)
	}

	products := []productDef{
		// ── Supplements ──────────────────────────────────────────────────────────
		{
			name: "Whey Protein 1kg – Chocolate", sku: "SUPP-WPC-CHOC-1K",
			category: "supplements", description: "Chocolate flavoured whey concentrate, 24g protein per scoop",
			mrpPaise: 299900, pricePaise: 249900, costPaise: 150000, stockQty: 30, lowStockAt: 5,
		},
		{
			name: "Whey Protein 1kg – Vanilla", sku: "SUPP-WPC-VANI-1K",
			category: "supplements", description: "Vanilla flavoured whey concentrate, 24g protein per scoop",
			mrpPaise: 299900, pricePaise: 249900, costPaise: 150000, stockQty: 25, lowStockAt: 5,
		},
		{
			name: "Whey Protein 2kg – Chocolate", sku: "SUPP-WPC-CHOC-2K",
			category: "supplements", description: "Value pack chocolate whey, 24g protein per scoop",
			mrpPaise: 549900, pricePaise: 449900, costPaise: 280000, stockQty: 15, lowStockAt: 3,
		},
		{
			name: "Creatine Monohydrate 300g", sku: "SUPP-CREAT-300",
			category: "supplements", description: "Micronised creatine monohydrate, unflavoured",
			mrpPaise: 89900, pricePaise: 74900, costPaise: 40000, stockQty: 40, lowStockAt: 8,
		},
		{
			name: "Pre-Workout – Mango Blast 300g", sku: "SUPP-PRE-MANGO",
			category: "supplements", description: "High-stim pre-workout with caffeine, beta-alanine & arginine",
			mrpPaise: 199900, pricePaise: 169900, costPaise: 90000, stockQty: 20, lowStockAt: 5,
		},
		{
			name: "BCAA 2:1:1 – Watermelon 500g", sku: "SUPP-BCAA-WM",
			category: "supplements", description: "Branched-chain amino acids 2:1:1 ratio, watermelon flavour",
			mrpPaise: 149900, pricePaise: 124900, costPaise: 70000, stockQty: 25, lowStockAt: 5,
		},
		{
			name: "Mass Gainer 3kg – Chocolate", sku: "SUPP-MASS-CHOC-3K",
			category: "supplements", description: "High-calorie mass gainer, 60g carbs & 25g protein per serving",
			mrpPaise: 599900, pricePaise: 499900, costPaise: 300000, stockQty: 10, lowStockAt: 2,
		},
		{
			name: "Glutamine 250g", sku: "SUPP-GLUT-250",
			category: "supplements", description: "L-Glutamine powder for recovery, unflavoured",
			mrpPaise: 79900, pricePaise: 64900, costPaise: 35000, stockQty: 30, lowStockAt: 6,
		},
		{
			name: "Multivitamin 60 Tablets", sku: "SUPP-MULTI-60T",
			category: "supplements", description: "Daily multivitamin with 23 vitamins & minerals",
			mrpPaise: 59900, pricePaise: 49900, costPaise: 25000, stockQty: 50, lowStockAt: 10,
		},
		{
			name: "Omega-3 Fish Oil 60 Softgels", sku: "SUPP-OMEGA3-60",
			category: "supplements", description: "EPA 180mg & DHA 120mg per softgel",
			mrpPaise: 69900, pricePaise: 54900, costPaise: 30000, stockQty: 45, lowStockAt: 8,
		},
		{
			name: "Protein Bar – Choco Fudge (Box of 12)", sku: "SUPP-BAR-CHOC-12",
			category: "supplements", description: "20g protein per bar, low sugar, 12-bar box",
			mrpPaise: 119900, pricePaise: 99900, costPaise: 60000, stockQty: 20, lowStockAt: 4,
		},
		{
			name: "Electrolyte Sachet Pack (30 sachets)", sku: "SUPP-ELEC-30S",
			category: "supplements", description: "Hydration electrolytes with sodium, potassium & magnesium",
			mrpPaise: 49900, pricePaise: 39900, costPaise: 20000, stockQty: 35, lowStockAt: 8,
		},

		// ── Apparel ──────────────────────────────────────────────────────────────
		{
			name: "Gym T-Shirt – Dri-Fit Black (M)", sku: "APP-TSHIRT-BLK-M",
			category: "apparel", description: "Moisture-wicking polyester gym tee, black",
			mrpPaise: 79900, pricePaise: 59900, costPaise: 25000, stockQty: 20, lowStockAt: 4,
		},
		{
			name: "Gym T-Shirt – Dri-Fit Black (L)", sku: "APP-TSHIRT-BLK-L",
			category: "apparel", description: "Moisture-wicking polyester gym tee, black",
			mrpPaise: 79900, pricePaise: 59900, costPaise: 25000, stockQty: 20, lowStockAt: 4,
		},
		{
			name: "Gym T-Shirt – Dri-Fit Navy (M)", sku: "APP-TSHIRT-NVY-M",
			category: "apparel", description: "Moisture-wicking polyester gym tee, navy",
			mrpPaise: 79900, pricePaise: 59900, costPaise: 25000, stockQty: 15, lowStockAt: 4,
		},
		{
			name: "Compression Shorts – Black (M)", sku: "APP-SHORTS-BLK-M",
			category: "apparel", description: "4-way stretch compression shorts, 7-inch inseam",
			mrpPaise: 99900, pricePaise: 79900, costPaise: 35000, stockQty: 15, lowStockAt: 3,
		},
		{
			name: "Compression Shorts – Black (L)", sku: "APP-SHORTS-BLK-L",
			category: "apparel", description: "4-way stretch compression shorts, 7-inch inseam",
			mrpPaise: 99900, pricePaise: 79900, costPaise: 35000, stockQty: 15, lowStockAt: 3,
		},
		{
			name: "Track Pants – Slim Fit Black (M)", sku: "APP-PANTS-BLK-M",
			category: "apparel", description: "Slim-fit jogger track pants with drawstring",
			mrpPaise: 149900, pricePaise: 119900, costPaise: 55000, stockQty: 10, lowStockAt: 2,
		},
		{
			name: "Track Pants – Slim Fit Black (L)", sku: "APP-PANTS-BLK-L",
			category: "apparel", description: "Slim-fit jogger track pants with drawstring",
			mrpPaise: 149900, pricePaise: 119900, costPaise: 55000, stockQty: 10, lowStockAt: 2,
		},
		{
			name: "Sports Bra – Medium Support (S)", sku: "APP-BRA-MED-S",
			category: "apparel", description: "Medium-support sports bra with racerback",
			mrpPaise: 89900, pricePaise: 69900, costPaise: 30000, stockQty: 12, lowStockAt: 3,
		},
		{
			name: "Sports Bra – Medium Support (M)", sku: "APP-BRA-MED-M",
			category: "apparel", description: "Medium-support sports bra with racerback",
			mrpPaise: 89900, pricePaise: 69900, costPaise: 30000, stockQty: 12, lowStockAt: 3,
		},
		{
			name: "Gym Cap – Black", sku: "APP-CAP-BLK",
			category: "apparel", description: "Adjustable snapback gym cap",
			mrpPaise: 49900, pricePaise: 39900, costPaise: 15000, stockQty: 25, lowStockAt: 5,
		},
		{
			name: "Gym Gloves – Size M", sku: "APP-GLOVES-M",
			category: "apparel", description: "Weight-training gloves with wrist support",
			mrpPaise: 59900, pricePaise: 49900, costPaise: 22000, stockQty: 20, lowStockAt: 4,
		},
		{
			name: "Gym Gloves – Size L", sku: "APP-GLOVES-L",
			category: "apparel", description: "Weight-training gloves with wrist support",
			mrpPaise: 59900, pricePaise: 49900, costPaise: 22000, stockQty: 20, lowStockAt: 4,
		},

		// ── Equipment / Accessories ───────────────────────────────────────────────
		{
			name: "Resistance Band Set (5 bands)", sku: "EQ-RESBAND-SET5",
			category: "equipment", description: "5 resistance levels from 5lb to 50lb",
			mrpPaise: 79900, pricePaise: 64900, costPaise: 28000, stockQty: 25, lowStockAt: 5,
		},
		{
			name: "Skipping Rope – Speed", sku: "EQ-SKIPROPE-SPD",
			category: "equipment", description: "Adjustable-length speed skipping rope with ball bearings",
			mrpPaise: 49900, pricePaise: 39900, costPaise: 15000, stockQty: 30, lowStockAt: 6,
		},
		{
			name: "Foam Roller – 60cm", sku: "EQ-FOAMROLL-60",
			category: "equipment", description: "High-density EVA foam roller for muscle recovery",
			mrpPaise: 89900, pricePaise: 74900, costPaise: 35000, stockQty: 15, lowStockAt: 3,
		},
		{
			name: "Gym Bag – 30L Duffel", sku: "EQ-BAG-30L",
			category: "equipment", description: "30L duffel gym bag with separate shoe compartment",
			mrpPaise: 199900, pricePaise: 169900, costPaise: 80000, stockQty: 10, lowStockAt: 2,
		},
		{
			name: "Shaker Bottle 700ml", sku: "EQ-SHAKER-700",
			category: "equipment", description: "BPA-free mixing bottle with stainless steel blender ball",
			mrpPaise: 39900, pricePaise: 29900, costPaise: 12000, stockQty: 50, lowStockAt: 10,
		},
		{
			name: "Lifting Straps – Pair", sku: "EQ-LIFTSTRAP",
			category: "equipment", description: "Cotton lifting straps for deadlifts & pulls",
			mrpPaise: 34900, pricePaise: 29900, costPaise: 12000, stockQty: 25, lowStockAt: 5,
		},
		{
			name: "Knee Wraps – Pair", sku: "EQ-KNEEWRAP",
			category: "equipment", description: "Elastic knee wraps for squats, 2m length",
			mrpPaise: 59900, pricePaise: 49900, costPaise: 22000, stockQty: 20, lowStockAt: 4,
		},
		{
			name: "Gym Belt – Leather 4-inch", sku: "EQ-BELT-LEATHER",
			category: "equipment", description: "4-inch genuine leather weightlifting belt, size M",
			mrpPaise: 249900, pricePaise: 199900, costPaise: 100000, stockQty: 8, lowStockAt: 2,
		},
		{
			name: "Yoga Mat 6mm – Purple", sku: "EQ-YOGAMAT-PRP",
			category: "equipment", description: "Non-slip 6mm TPE yoga mat with carry strap",
			mrpPaise: 129900, pricePaise: 99900, costPaise: 45000, stockQty: 12, lowStockAt: 2,
		},
		{
			name: "Yoga Mat 6mm – Blue", sku: "EQ-YOGAMAT-BLU",
			category: "equipment", description: "Non-slip 6mm TPE yoga mat with carry strap",
			mrpPaise: 129900, pricePaise: 99900, costPaise: 45000, stockQty: 12, lowStockAt: 2,
		},

		// ── Other ─────────────────────────────────────────────────────────────────
		{
			name: "Gym Towel – Microfibre Large", sku: "OTH-TOWEL-LG",
			category: "other", description: "Quick-dry microfibre gym towel, 100×50cm",
			mrpPaise: 44900, pricePaise: 34900, costPaise: 15000, stockQty: 40, lowStockAt: 8,
		},
		{
			name: "Gym Towel – Microfibre Small", sku: "OTH-TOWEL-SM",
			category: "other", description: "Quick-dry microfibre hand towel, 60×30cm",
			mrpPaise: 24900, pricePaise: 19900, costPaise: 8000, stockQty: 50, lowStockAt: 10,
		},
		{
			name: "Sports Water Bottle 1L – Black", sku: "OTH-BOTTLE-1L-BLK",
			category: "other", description: "Stainless steel insulated sports bottle",
			mrpPaise: 89900, pricePaise: 74900, costPaise: 35000, stockQty: 20, lowStockAt: 4,
		},
		{
			name: "Hand Sanitizer 100ml", sku: "OTH-SANI-100",
			category: "other", description: "70% alcohol instant hand sanitizer",
			mrpPaise: 14900, pricePaise: 11900, costPaise: 5000, stockQty: 60, lowStockAt: 15,
		},
		{
			name: "Gym Lock – Combination", sku: "OTH-LOCK-COMBO",
			category: "other", description: "4-digit combination padlock for locker",
			mrpPaise: 34900, pricePaise: 29900, costPaise: 12000, stockQty: 15, lowStockAt: 3,
		},
	}

	seeded, skipped := 0, 0
	for _, pd := range products {
		var existing models.Product
		if err := db.Where("sku = ?", pd.sku).First(&existing).Error; err == nil {
			logger.Info("skip (exists)", "sku", pd.sku)
			skipped++
			continue
		}

		p := &models.Product{
			Name:        pd.name,
			SKU:         pd.sku,
			Category:    pd.category,
			Description: pd.description,
			MrpPaise:    pd.mrpPaise,
			PricePaise:  pd.pricePaise,
			CostPaise:   pd.costPaise,
			StockQty:    pd.stockQty,
			LowStockAt:  pd.lowStockAt,
			IsActive:    true,
		}
		if err := db.Create(p).Error; err != nil {
			logger.Error("create failed", "sku", pd.sku, "err", err)
			continue
		}
		logger.Info("seeded", "sku", pd.sku, "name", pd.name)
		seeded++
	}
	logger.Info("POS seed complete", "seeded", seeded, "skipped", skipped)
}
