# JobSearch Platform

An AI-powered job search platform with intelligent matching, resume analysis, and interview preparation tools.

## 🚀 Features

### Core Modules
- **User Authentication** - Secure login and registration system
- **Resume Analysis** - AI-powered resume parsing and skill extraction
- **Job Matching Engine** - Intelligent job recommendations based on profile
- **Interview Simulator** - AI-powered interview practice with real-time feedback
- **Analytics Dashboard** - Track your job search progress and performance
- **Real-time Notifications** - WebSocket-based instant updates

### Technical Features
- **Modern UI/UX** - Built with TailwindCSS and Headless UI
- **Responsive Design** - Works seamlessly on all devices
- **Real-time Updates** - WebSocket integration for live data
- **Data Visualization** - Interactive charts with Recharts
- **Type Safety** - Full TypeScript support

## 🛠 Tech Stack

### Frontend
- **Next.js 14** - React framework with App Router
- **React 18** - Modern React with hooks
- **TypeScript** - Type-safe development
- **TailwindCSS** - Utility-first CSS framework
- **Headless UI** - Accessible UI components
- **Recharts** - Data visualization library
- **Lucide React** - Beautiful icons
- **Framer Motion** - Smooth animations

### Backend Integration
- **FastAPI** - Python backend (planned)
- **WebSocket** - Real-time communication
- **PostgreSQL** - Primary database
- **Redis** - Caching and sessions
- **Celery** - Background tasks

## 📦 Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd job_search_platform
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   ```bash
   cp .env.example .env.local
   ```
   Edit `.env.local` with your configuration:
   ```
   NEXT_PUBLIC_API_URL=http://localhost:8000
   NEXT_PUBLIC_WS_URL=ws://localhost:8000
   ```

### Edition Switch

- `CN=1` means the CN edition. It uses CloudBase as the remote data source and keeps the existing WeChat Pay flow.
- `CN=0` means the global edition. It switches the remote data source to Supabase and hides the WeChat Pay entry.
- When `CN=0`, the server expects `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_DOCUMENTS_TABLE`, and `SUPABASE_STORAGE_BUCKET`.
- The Supabase bootstrap SQL is in `supabase/schema.sql`. Run it once in the Supabase SQL editor before starting the global edition.

4. **Run the development server**
   ```bash
   npm run dev
   ```

5. **Open your browser**
   Navigate to [http://localhost:3000](http://localhost:3000)

## 🏗 Project Structure

```
job_search_platform/
├── app/                    # Next.js App Router
│   ├── globals.css        # Global styles
│   ├── layout.tsx         # Root layout
│   └── page.tsx           # Home page
├── components/            # React components
│   ├── AuthProvider.tsx   # Authentication context
│   ├── Dashboard.tsx      # Main dashboard
│   ├── JobRecommendations.tsx # Job matching
│   ├── ResumeAnalysis.tsx # Resume analysis
│   ├── InterviewSimulator.tsx # Interview practice
│   ├── Analytics.tsx      # Analytics dashboard
│   ├── Settings.tsx       # User settings
│   └── Navigation.tsx     # Navigation component
├── lib/                   # Utility functions
├── types/                 # TypeScript types
├── public/                # Static assets
└── package.json           # Dependencies
```

## 🎯 Key Features

### 1. Intelligent Job Matching
- AI-powered job recommendations
- Skill-based matching algorithm
- Personalized job suggestions
- Match score visualization

### 2. Resume Analysis
- Automated resume parsing
- Skill extraction and analysis
- Improvement suggestions
- Market demand analysis

### 3. Interview Preparation
- AI-powered interview simulator
- Real-time feedback
- Performance analytics
- Practice question bank

### 4. Analytics Dashboard
- Job search progress tracking
- Application statistics
- Interview performance metrics
- Market insights

## 🔧 Development

### Available Scripts
- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run start` - Start production server
- `npm run lint` - Run ESLint

### Code Style
- TypeScript for type safety
- TailwindCSS for styling
- ESLint for code quality
- Prettier for formatting

## 🚀 Deployment

### Vercel (Recommended)
1. Connect your GitHub repository
2. Configure environment variables
3. Deploy automatically

### Other Platforms
- **Netlify** - Static site hosting
- **AWS Amplify** - Full-stack hosting
- **Docker** - Containerized deployment

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- Built with Next.js and React
- Styled with TailwindCSS
- Icons from Lucide React
- Charts powered by Recharts

## 📞 Support

For support and questions:
- Create an issue on GitHub
- Contact the development team
- Check the documentation

---

**JobSearch Platform** - Empowering your career journey with AI-powered insights and tools. 
