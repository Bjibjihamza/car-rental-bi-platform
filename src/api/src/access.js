// src/api/src/access.js

function role(req) {
  return String(req?.user?.role || "").toLowerCase();
}

function isSupervisor(req) {
  return role(req) === "supervisor";
}

function isManager(req) {
  return role(req) === "manager";
}

function requireManager(req) {
  if (!isManager(req)) {
    const err = new Error("Managers only");
    err.status = 403;
    throw err;
  }
  return req.user;
}

function requireManagerId(req) {
  const u = requireManager(req);
  const id = u?.managerId ?? u?.MANAGER_ID ?? null;
  const n = Number(id);
  if (!n) {
    const err = new Error("managerId is missing in token");
    err.status = 403;
    throw err;
  }
  return n;
}

function requireBranch(req) {
  const branchId = req?.user?.branchId ?? req?.user?.BRANCH_ID ?? null;
  const n = Number(branchId);
  if (!n) {
    const err = new Error("Branch is required for this user");
    err.status = 403;
    throw err;
  }
  return n;
}

module.exports = {
  isSupervisor,
  isManager,
  requireManager,
  requireManagerId,
  requireBranch,
};
