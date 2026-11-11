package constants

const (
	RoleAdmin            = "admin"
	RoleManager          = "manager"
	RoleTrainer          = "trainer"
	RoleTrainerAssistant = "trainer_assistant"
	RoleMember           = "member"
)

// AllRoles lists every valid role.
var AllRoles = []string{
	RoleAdmin,
	RoleManager,
	RoleTrainer,
	RoleTrainerAssistant,
	RoleMember,
}

// StaffRoles can manage gym operations.
var StaffRoles = []string{
	RoleAdmin,
	RoleManager,
	RoleTrainer,
	RoleTrainerAssistant,
}
