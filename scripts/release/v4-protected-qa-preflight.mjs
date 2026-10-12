#!/usr/bin/env node
/** Fail closed BEFORE costly builds. Names only; never print secret values. */
const profile=process.argv[2];
const groups={
  "studio-owner": [
    "SERVICEDESK_QA_SUPABASE_PUBLISHABLE_KEY",
    "SERVICEDESK_QA_TEST_EMAIL",
    "SERVICEDESK_QA_TEST_PASSWORD",
    "SERVICEDESK_QA_TEST_WORKSPACE",
  ],
  "two-owner-rls": [
    "SERVICEDESK_QA_SUPABASE_PUBLISHABLE_KEY",
    "SERVICEDESK_QA_OWNER_A_EMAIL",
    "SERVICEDESK_QA_OWNER_A_PASSWORD",
    "SERVICEDESK_QA_OWNER_A_WORKSPACE",
    "SERVICEDESK_QA_OWNER_B_EMAIL",
    "SERVICEDESK_QA_OWNER_B_PASSWORD",
    "SERVICEDESK_QA_OWNER_B_WORKSPACE",
  ],
};
const required=groups[profile];
if(!required)throw Error("QA_PREFLIGHT_PROFILE_UNSUPPORTED");
const missing=required.filter(name=>!process.env[name]?.trim());
const slugKeys=required.filter(name=>name.endsWith("_WORKSPACE"));
const emailKeys=required.filter(name=>name.endsWith("_EMAIL"));
const passwordKeys=required.filter(name=>name.endsWith("_PASSWORD"));
const badEmail=emailKeys.filter(name=>{
  const value=process.env[name]??"";
  return value.length>254 || value!==value.trim() ||
    !/^[A-Z0-9._%+-]+@[A-Z0-9.-]+\\.[A-Z]{2,}$/i.test(value) ||
    value.includes("..");
});
const badPassword=passwordKeys.filter(name=>{
  const value=process.env[name]??"";
  return value.length<8 || value.length>512 ||
    /[\\r\\n\\u0000]/.test(value);
});
const badSlug=slugKeys.filter(name=>process.env[name]&&
    (process.env[name].length>40 || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(process.env[name])));
const key=process.env.SERVICEDESK_QA_SUPABASE_PUBLISHABLE_KEY;
if(key&&!/^sb_publishable_[A-Za-z0-9_-]{8,}$/.test(key))
  badSlug.push("SERVICEDESK_QA_SUPABASE_PUBLISHABLE_KEY");
if(process.env.SUPABASE_SERVICE_ROLE_KEY||process.env.SUPABASE_SECRET_KEY)
  throw Error("QA_PREFLIGHT_FORBIDDEN_PRIVILEGED_SUPABASE_KEY");
if(missing.length||badSlug.length||badEmail.length||badPassword.length) {
  // Environment variable NAMES are not secrets. Account identifiers and
  // credential material must never appear in logs or this diagnostic.
  throw Error("QA_PREFLIGHT_BLOCKED:"+
    [...new Set([
      ...missing.map(x=>"MISSING_"+x),
      ...badSlug.map(x=>"INVALID_"+x),
      ...badEmail.map(x=>"INVALID_"+x),
      ...badPassword.map(x=>"INVALID_"+x),
    ])].join(","));
}
if(profile==="two-owner-rls") {
  if(process.env.SERVICEDESK_QA_OWNER_A_EMAIL.toLowerCase()===
      process.env.SERVICEDESK_QA_OWNER_B_EMAIL.toLowerCase()||
      process.env.SERVICEDESK_QA_OWNER_A_WORKSPACE===
      process.env.SERVICEDESK_QA_OWNER_B_WORKSPACE)
    throw Error("QA_PREFLIGHT_BLOCKED:DISTINCT_QA_OWNERS_AND_TENANTS_REQUIRED");
}
console.log("QA_PREFLIGHT_CONFIG_READY:"+profile+
  " (identity verification and real database isolation NOT YET PROVEN)");
