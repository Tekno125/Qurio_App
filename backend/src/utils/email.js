import EmailValidator from "validator"

const ALLOWED_EMAIL_DOMAINS = new Set([
    "gmail.com",
    "yahoo.com",
    "outlook.com"
])

export const normalizeEmailAddress = (email) => {
    if (typeof email !== "string") {
        return null
    }

    const trimmedEmail = email.trim()
    if (!EmailValidator.isEmail(trimmedEmail)) {
        return null
    }

    const separatorIndex = trimmedEmail.lastIndexOf("@")
    const localPart = trimmedEmail.slice(0, separatorIndex)
    const domain = trimmedEmail.slice(separatorIndex + 1).toLowerCase()

    return `${localPart}@${domain}`
}

export const isAllowedRegistrationEmailDomain = (domain) => {
    if (typeof domain !== "string") {
        return false
    }

    const normalizedDomain = domain.trim().toLowerCase()
    return ALLOWED_EMAIL_DOMAINS.has(normalizedDomain) ||
        (normalizedDomain.length > ".sch.id".length &&
            normalizedDomain.endsWith(".sch.id"))
}
