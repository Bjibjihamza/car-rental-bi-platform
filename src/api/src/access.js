// src/api/src/access.js
function isSupervisor(req) {
  return String(req?.user?.role || "").toLowerCase() === "supervisor";
}

function requireBranch(req) {
  const branchId = req?.user?.branchId ?? null;
  if (!branchId) {
    const err = new Error("Branch is required for this user");
    err.status = 403;
    throw err;
  }
  return branchId;
}

module.exports = { isSupervisor, requireBranch };
