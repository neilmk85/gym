package handlers

// ownership.go — helpers that enforce resource-ownership rules so that a
// member-role caller can only access resources that belong to their own member
// profile. Admin and manager roles bypass every check.

import (
	"net/http"

	"gym-backend/internal/apperrors"
	"gym-backend/internal/constants"
	"gym-backend/internal/response"
	"gym-backend/internal/services"
)

// requireMemberOwnership ensures that a caller with the "member" role can only
// reach resources that belong to their own member profile. Admins and managers
// are allowed through unconditionally.
//
// targetMemberID is the member ID that the resource belongs to (e.g. the
// {id} path segment on /members/{id}/…, or the MemberID field of a booking /
// subscription fetched from the database).
//
// Returns true when the caller is permitted, false when a 403 has already been
// written to w (caller must return immediately).
func requireMemberOwnership(
	w http.ResponseWriter,
	r *http.Request,
	claims *services.Claims,
	targetMemberID uint,
	memberSvc services.MemberService,
) bool {
	if claims == nil {
		response.Error(w, r, apperrors.New(http.StatusForbidden, "AUTH_003",
			"Forbidden", ""))
		return false
	}

	// Non-member roles (admin, manager, trainer) have full access.
	if claims.Role != constants.RoleMember {
		return true
	}

	// Look up the member profile that belongs to the caller's user account.
	callerMember, err := memberSvc.GetByUserID(claims.UserID)
	if err != nil || callerMember == nil {
		response.Error(w, r, apperrors.New(http.StatusForbidden, "AUTH_003",
			"Forbidden: member profile not found", ""))
		return false
	}

	if callerMember.ID != targetMemberID {
		response.Error(w, r, apperrors.New(http.StatusForbidden, "AUTH_003",
			"Forbidden: resource belongs to another member", ""))
		return false
	}

	return true
}
