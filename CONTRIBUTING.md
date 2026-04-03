# Contributing to India Fat to Fit

Thank you for your interest in contributing to India's first open-source GLP-1 weight loss platform. We welcome contributions from developers, designers, clinicians, and public health researchers.

## How to Contribute

### Reporting Issues
- Use [GitHub Issues](https://github.com/akhileshwar994/AKIVA-HEALTH-INDIA-FAT-TO-FIT-PROGRAM/issues) to report bugs or suggest features
- Include screenshots for UI issues
- Reference specific clinical sources if suggesting evidence-based changes

### Pull Requests
1. Fork the repository
2. Create a feature branch: `git checkout -b feature/your-feature-name`
3. Make your changes
4. Test locally by opening `index.html` in a browser
5. Commit: `git commit -m 'feat: add your feature description'`
6. Push: `git push origin feature/your-feature-name`
7. Open a Pull Request with a clear description

### Commit Convention
We follow [Conventional Commits](https://www.conventionalcommits.org/):
- `feat:` — New feature
- `fix:` — Bug fix
- `docs:` — Documentation change
- `style:` — Code formatting (not CSS changes)
- `refactor:` — Code refactoring
- `perf:` — Performance improvement
- `test:` — Adding tests

## Development Guidelines

### Code Style
- Use semantic HTML5 elements
- CSS custom properties for theming
- ES6+ JavaScript (no transpilation needed)
- Mobile-first responsive design
- WCAG AA accessibility compliance

### Clinical Evidence Standards
When adding clinical data or modifying evidence sections:
- **Only use PubMed-indexed, peer-reviewed sources**
- Include the DOI and PMC/PMID number
- Link directly to the original article
- Clearly distinguish between primary data and interpretations
- Follow ICMR/WHO guidelines for India-specific recommendations

### Design System
- Primary: `#E63946` (coral red)
- Secondary: `#1D3557` (deep navy)
- Accent: `#457B9D` (medical blue)
- Success: `#2A9D8F` (teal)
- Fonts: Clash Display (headings) + Satoshi (body)

## Priority Areas

We especially need help with:

### High Priority
- **Multi-language support** — Hindi, Tamil, Telugu, Bengali, Marathi, Gujarati
- **Backend API** — Move from localStorage to a proper database
- **Authentication** — Proper doctor/patient login system

### Medium Priority
- **Mobile app** — React Native or Flutter implementation
- **AI diet generator** — Personalized Indian diet plans using LLMs
- **WhatsApp chatbot** — Patient communication automation
- **Blood work OCR** — Automated lab report analysis

### Good First Issues
- Accessibility improvements (aria labels, keyboard navigation)
- SEO optimizations (meta tags, structured data)
- Additional FAQ questions
- More regional diet plan content
- Bug fixes and UI polish

## Code of Conduct

- Be respectful and constructive
- Clinical accuracy is paramount — do not add unverified health claims
- This is a medical platform — take patient safety seriously
- Follow evidence-based medicine principles

## Questions?

- Open a [GitHub Discussion](https://github.com/akhileshwar994/AKIVA-HEALTH-INDIA-FAT-TO-FIT-PROGRAM/discussions)
- Email: care@indiafattofit.com
- WhatsApp: +91-7801009912
