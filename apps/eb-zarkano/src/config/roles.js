export const roleIds = Object.freeze({
  staff: "1543396104865841242",
  membro: "1543706870307618938",
});

export function getConfiguredRoleId(roleKey) {
  const roleId = roleIds[roleKey];

  if (typeof roleId !== "string" || roleId.trim().length === 0) {
    return null;
  }

  return roleId.trim();
}
