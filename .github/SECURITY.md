# Security Policy

## Supported Versions

| Version | Supported |
| ------- | --------- |
| latest `main` / newest release | ✅ |
| older releases | ❌ |

## Reporting a Vulnerability

Please use [GitHub's private security reporting][advisory] (preferred), or email **ikoobee@outlook.com** if that is not possible.

[advisory]: https://github.com/ikoobee/classroom-seating/security/advisories/new

- Include reproduction steps (sample Excel/JSON file if relevant) and an impact assessment.
- **Do not open a public issue for security problems.**
- You can expect an acknowledgement within 7 days.

## Scope Notes

Classroom Seating is a pure client-side application: no backend, no accounts, no data ever leaves the browser. In-scope areas include:

- XSS via imported files (Excel / JSON backup / template download)
- Prototype pollution or infinite loops in the seating engine triggered by crafted inputs
- Third-party script loading (`assets/vendor/` with CDN fallback — integrity concerns)

Out of scope: attacks requiring physical access to the teacher's machine, or vulnerabilities in the browser itself.
