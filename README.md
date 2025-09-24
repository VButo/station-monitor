# Station Monitor 🌡️📊

A comprehensive full-stack application for monitoring weather station networks with real-time data visualization, advanced filtering, and automated health tracking.

## ✨ Features

### 🎯 **Core Functionality**
- **Real-time Station Monitoring** - Live dashboard with auto-refresh every 10 minutes
- **Advanced Data Table** - Dynamic column management with AG-Grid integration
- **Health Analytics** - Track both connection health and data quality metrics
- **Interactive Timeline** - 24-hour status visualization for each station
- **Smart Filtering** - Multiple filter types with floating filters for instant search

### 🔧 **Technical Highlights**
- **Performance Optimized** - Backend caching system with cron scheduling
- **Responsive Design** - Modern UI with Tailwind CSS
- **Type Safety** - Full TypeScript implementation
- **Database Integration** - Supabase backend with RPC functions
- **Authentication** - Secure user management system

## 🏗️ Architecture

```
station-monitor/
├── backend/           # Node.js + Express API
│   ├── src/
│   │   ├── controllers/    # API route handlers
│   │   ├── services/       # Business logic & caching
│   │   ├── middleware/     # Auth & error handling
│   │   ├── routes/         # API endpoints
│   │   ├── types/          # TypeScript definitions
│   │   └── utils/          # Database & logging utilities
│   └── package.json
├── frontend/          # Next.js React Application
│   ├── src/
│   │   ├── app/           # Next.js 14 App Router
│   │   ├── components/    # Reusable UI components
│   │   ├── types/         # Frontend type definitions
│   │   └── utils/         # API helpers & utilities
│   └── package.json
└── README.md
```

## 🚀 Getting Started

### Prerequisites
- Node.js 18+ 
- npm or yarn
- Supabase account and project

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/VButo/station-monitor.git
   cd station-monitor
   ```

2. **Install root dependencies**
   ```bash
   npm install
   ```

3. **Setup Backend**
   ```bash
   cd backend
   npm install
   cp .env.example .env  # Configure your environment variables
   ```

4. **Setup Frontend**
   ```bash
   cd ../frontend
   npm install
   cp .env.local.example .env.local  # Configure your environment variables
   ```

### Environment Configuration

#### Backend (.env)
```env
SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
PORT=5000
NODE_ENV=development
```

#### Frontend (.env.local)
```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
NEXT_PUBLIC_API_BASE_URL=http://localhost:5000
```

### Running the Application

#### Development Mode

1. **Start Backend Server**
   ```bash
   cd backend
   npm run dev
   ```

2. **Start Frontend Development Server**
   ```bash
   cd frontend
   npm run dev
   ```

3. **Access the Application**
   - Frontend: http://localhost:3000
   - Backend API: http://localhost:5000

#### Production Mode
```bash
# Build and start both services
npm run build
npm start
```

## 📊 Features Overview

### 🖥️ **Dashboard Views**

#### **Advanced Data Table**
- **Dynamic Columns** - Show/hide columns by groups (Location, Health, Public Data, etc.)
- **Smart Filtering** - Text, numeric, date, and set filters with floating filter bar
- **Real-time Updates** - Auto-refresh preserves table state and user selections
- **Export Capabilities** - Download filtered data in various formats

#### **Station Health Monitoring**
- **Connection Health** - Track station online status (24h/7d averages)
- **Data Quality** - Monitor data validity and completeness
- **Status Timeline** - Visual 24-hour status representation
- **Alert System** - Identify stations with poor performance

#### **Network Overview**
- **Interactive Map** - Geographic visualization of station locations
- **Status Summary** - Quick overview of network health
- **Station Details** - Drill-down views with comprehensive metrics

### 🔧 **Backend Services**

#### **Caching System**
- **Scheduled Updates** - Cron jobs refresh data every 10 minutes
- **Performance Optimization** - In-memory caching reduces database load
- **Cache Management** - Automatic cache invalidation and health monitoring

#### **API Endpoints**
- `GET /stations` - List all stations with basic info
- `GET /stations/advanced-table` - Comprehensive station data with health metrics
- `GET /stations/:id` - Detailed station information
- `POST /auth/login` - User authentication
- `GET /health` - API health check

## 🛠️ Technology Stack

### **Backend**
- **Runtime**: Node.js 18+
- **Framework**: Express.js
- **Database**: Supabase (PostgreSQL)
- **Language**: TypeScript
- **Caching**: In-memory with node-cron scheduling
- **Authentication**: Supabase Auth

### **Frontend**
- **Framework**: Next.js 14 (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **Data Grid**: AG-Grid Community
- **State Management**: React Hooks
- **HTTP Client**: Custom API utility with fetch

### **Development Tools**
- **Linting**: ESLint
- **Type Checking**: TypeScript
- **Package Manager**: npm
- **Version Control**: Git

## 📈 Performance Features

- **Backend Caching**: 10-minute scheduled updates reduce API response times
- **Optimized Queries**: Efficient database queries with proper indexing  
- **Client-side Filtering**: Instant table filtering without server requests
- **Progressive Loading**: Lazy loading for large datasets
- **Memory Management**: Proper cleanup and garbage collection

## 🔒 Security

- **Environment Variables**: Sensitive data stored securely
- **API Authentication**: JWT-based authentication system
- **CORS Protection**: Configured for production deployment
- **Input Validation**: Server-side validation for all inputs
- **SQL Injection Prevention**: Parameterized queries

## 📱 Responsive Design

- **Mobile First**: Optimized for mobile devices
- **Tablet Support**: Enhanced layouts for tablet views
- **Desktop Experience**: Full-featured desktop interface
- **Cross-browser**: Compatible with modern browsers

## 🧪 Development

### **Code Structure**
- **Modular Architecture**: Clear separation of concerns
- **Type Safety**: Comprehensive TypeScript coverage
- **Error Handling**: Centralized error management
- **Logging**: Structured logging for debugging

### **Available Scripts**

#### Root Level
```bash
npm run dev          # Start both frontend and backend in development
npm run build        # Build both applications
npm start            # Start both applications in production
```

#### Backend
```bash
npm run dev          # Start development server with hot reload
npm run build        # Compile TypeScript
npm start            # Start production server
npm run lint         # Run ESLint
```

#### Frontend
```bash
npm run dev          # Start Next.js development server
npm run build        # Build for production
npm start            # Start production server
npm run lint         # Run ESLint
```

## 📦 Deployment

### **Vercel (Frontend)**
```bash
# Install Vercel CLI
npm i -g vercel

# Deploy frontend
cd frontend
vercel --prod
```

### **Railway/Heroku (Backend)**
```bash
# Add your deployment platform of choice
# Configure environment variables in platform dashboard
```

### **Docker (Full Stack)**
```dockerfile
# Dockerfile configurations available for containerized deployment
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 📞 Support

For support and questions:
- Create an issue on GitHub
- Check the documentation in `/docs`
- Review the API documentation at `/backend/docs`

## 🎯 Roadmap

- [ ] Real-time WebSocket updates
- [ ] Advanced alerting system
- [ ] Mobile application
- [ ] Historical data analysis
- [ ] Machine learning predictions
- [ ] Multi-tenancy support

---

Built with ❤️ using Next.js, Express.js, and Supabase