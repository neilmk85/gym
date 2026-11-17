package constants

const (
	RoleSuperAdmin = "superadmin"
	RoleOwner      = "owner"
	RoleReception  = "reception"
	RoleManager    = "manager"
	RoleTrainer    = "trainer"
	RoleMember     = "member"
)

// AllRoles lists every valid role.
var AllRoles = []string{
	RoleSuperAdmin,
	RoleOwner,
	RoleReception,
	RoleManager,
	RoleTrainer,
	RoleMember,
}

// StaffRoles can manage gym operations.
var StaffRoles = []string{
	RoleOwner,
	RoleReception,
	RoleManager,
	RoleTrainer,
}

// ManageableRoles are the roles whose permissions can be configured.
var ManageableRoles = []string{
	RoleOwner,
	RoleReception,
	RoleManager,
	RoleTrainer,
}

// AllPermissions is the full list of feature permissions in the system.
var AllPermissions = []string{
	"members.view", "members.manage",
	"memberships.view", "memberships.manage",
	"payments.view", "payments.manage",
	"trainers.view", "trainers.manage",
	"classes.view", "classes.manage",
	"bookings.view", "bookings.manage",
	"attendance.view", "attendance.manage",
	"reports.view", "reports.manage",
	"staff.view", "staff.manage",
	"purchases.view", "purchases.manage",
	"coaching.view", "coaching.manage",
	"crm.view", "crm.manage",
	"retention.view", "retention.manage",
	"loyalty.view", "loyalty.manage",
	"settings.view", "settings.manage",
	"compliance.view", "compliance.manage",
}
