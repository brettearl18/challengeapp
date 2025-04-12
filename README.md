# ChallengeCoach

A comprehensive health and fitness coaching platform that combines personalized coaching, AI-driven insights, and community engagement to help users achieve their wellness goals.

## Project Structure

The project consists of three main components:
- Mobile App (Flutter)
- Web Dashboard (Next.js)
- Backend API (Node.js/Express)

### Features

#### Mobile App
- User authentication and profile management
- Personalized workout and nutrition plans
- Progress tracking and analytics
- AI-powered form correction
- Community features and social sharing
- Real-time chat with coaches
- Push notifications

#### Web Dashboard
- Coach dashboard for client management
- Analytics and reporting
- Content management system
- Administrative controls
- Payment processing

#### Backend
- RESTful API
- Real-time WebSocket connections
- Data analytics engine
- AI model integration
- Secure authentication
- Payment processing
- Cloud storage integration

### Tech Stack

- **Mobile**: Flutter, Provider (state management), Firebase
- **Web**: Next.js, TypeScript, Tailwind CSS
- **Backend**: Node.js, Express, PostgreSQL, Redis
- **AI Engine**: TensorFlow, OpenAI API
- **Infrastructure**: Docker, AWS, GitHub Actions

## Getting Started

### Prerequisites

- Node.js 18+
- Flutter 3.0+
- Docker
- PostgreSQL
- Redis

### Installation

1. Clone the repository:
```bash
git clone https://github.com/yourusername/challengecoach.git
cd challengecoach
```

2. Install dependencies:

For the mobile app:
```bash
cd mobile
flutter pub get
```

For the web dashboard:
```bash
cd web
npm install
```

For the backend:
```bash
cd backend
npm install
```

3. Set up environment variables:
- Copy `.env.example` to `.env` in each directory
- Update the variables with your configuration

### Development

Mobile App:
```bash
cd mobile
flutter run
```

Web Dashboard:
```bash
cd web
npm run dev
```

Backend:
```bash
cd backend
npm run dev
```

## Contributing

Please read [CONTRIBUTING.md](CONTRIBUTING.md) for details on our code of conduct and the process for submitting pull requests.

## License

This project is licensed under the MIT License - see the [LICENSE.md](LICENSE.md) file for details.
