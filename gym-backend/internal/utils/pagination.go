package utils

import (
	"math"
	"net/http"
	"strconv"
	"strings"

	"gorm.io/gorm"
)

const (
	defaultPage    = 1
	defaultPerPage = 20
	maxPerPage     = 100
)

type PageRequest struct {
	Page    int
	PerPage int
	Sort    string
	Search  string
	Filters map[string]string
}

type PageMeta struct {
	Page       int  `json:"page"`
	PerPage    int  `json:"per_page"`
	Total      int64 `json:"total"`
	TotalPages int  `json:"total_pages"`
	HasNext    bool `json:"has_next"`
	HasPrev    bool `json:"has_prev"`
}

func ParsePageRequest(r *http.Request) PageRequest {
	q := r.URL.Query()

	page, _ := strconv.Atoi(q.Get("page"))
	if page < 1 {
		page = defaultPage
	}

	perPage, _ := strconv.Atoi(q.Get("per_page"))
	if perPage < 1 {
		perPage = defaultPerPage
	}
	if perPage > maxPerPage {
		perPage = maxPerPage
	}

	filters := make(map[string]string)
	for _, key := range []string{
		"status", "facility_id", "role", "date_from", "date_to", "type",
		"from", "to", "method", "member_id", "trainer_id",
		"joined_from", "joined_to",
	} {
		if v := q.Get(key); v != "" {
			filters[key] = v
		}
	}

	return PageRequest{
		Page:    page,
		PerPage: perPage,
		Sort:    q.Get("sort"),
		Search:  q.Get("search"),
		Filters: filters,
	}
}

func (p PageRequest) Apply(db *gorm.DB) *gorm.DB {
	offset := (p.Page - 1) * p.PerPage
	db = db.Offset(offset).Limit(p.PerPage)

	if p.Sort != "" {
		field := p.Sort
		dir := "ASC"
		if strings.HasPrefix(field, "-") {
			field = field[1:]
			dir = "DESC"
		}
		// Whitelist safe sort fields to prevent SQL injection.
		safe := map[string]bool{
			"created_at": true, "updated_at": true, "name": true,
			"joined_date": true, "price_amount": true, "end_date": true,
		}
		if safe[field] {
			db = db.Order(field + " " + dir)
		}
	} else {
		db = db.Order("created_at DESC")
	}
	return db
}

func BuildPageMeta(req PageRequest, total int64) PageMeta {
	totalPages := int(math.Ceil(float64(total) / float64(req.PerPage)))
	return PageMeta{
		Page:       req.Page,
		PerPage:    req.PerPage,
		Total:      total,
		TotalPages: totalPages,
		HasNext:    req.Page < totalPages,
		HasPrev:    req.Page > 1,
	}
}
