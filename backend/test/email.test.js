import assert from "node:assert/strict"
import { test } from "node:test"
import {
    isAllowedRegistrationEmailDomain,
    normalizeEmailAddress
} from "../src/utils/email.js"

test("normalizes whitespace and domain casing without changing local-part casing", () => {
    assert.equal(
        normalizeEmailAddress("  Guru.Test@GMAIL.COM  "),
        "Guru.Test@gmail.com"
    )
})

test("rejects malformed email addresses", () => {
    assert.equal(normalizeEmailAddress("not-an-email"), null)
    assert.equal(normalizeEmailAddress(null), null)
})

for (const domain of ["gmail.com", "yahoo.com", "outlook.com", "sekolah.sch.id", "sub.sekolah.sch.id"]) {
    test(`allows registration domain ${domain}`, () => {
        assert.equal(isAllowedRegistrationEmailDomain(domain), true)
    })
}

for (const domain of ["tempmail.com", "protonmail.com", "gmail.com.example.org", "gmail.co", ".sch.id"]) {
    test(`rejects registration domain ${domain}`, () => {
        assert.equal(isAllowedRegistrationEmailDomain(domain), false)
    })
}
