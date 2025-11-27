# PaperWeight

A modern, production-ready resume review platform that connects job seekers with industry professionals for personalized feedback and career guidance.

![PaperWeight Logo](public/logo.png)

## Overview

PaperWeight is a comprehensive resume review platform built with modern web technologies. It enables users to upload their resumes, connect with experienced reviewers, and receive detailed feedback to improve their job applications. The platform features role-based access control, real-time messaging, and a sophisticated review system.

## Key Features

### For Job Seekers

- **Resume Upload & Management**: Secure PDF upload with preview functionality
- **Reviewer Discovery**: Browse and follow industry professionals
- **Real-time Messaging**: Chat with reviewers for personalized feedback
- **Progress Tracking**: Monitor review status and scores
- **Profile Management**: Comprehensive user profiles with career information

### For Reviewers

- **Professional Profiles**: Create detailed reviewer profiles with expertise areas
- **Resume Review Dashboard**: Manage incoming resume reviews
- **Interactive Review System**: Provide scores, feedback, and status updates
- **Experience Management**: Showcase professional background and expertise
- **Follower System**: Build a following and track engagement

  <img width="1440" height="900" alt="image" src="https://github.com/user-attachments/assets/74b999c1-857d-4900-ac23-e3e3c9ce54af" />


### For Administrators

- **User Management**: Comprehensive admin dashboard
- **Analytics**: Platform usage and performance metrics
- **Content Moderation**: Review and manage user-generated content

## 🛠 Tech Stack

### Frontend

- **Next.js 15.5.3** - React framework with App Router
- **React 19.1.0** - UI library with latest features
- **TypeScript 5** - Type-safe development
- **Tailwind CSS 4** - Utility-first styling
- **React PDF** - PDF preview and manipulation
- **React Dropzone** - File upload handling

### Backend & Database

- **Supabase** - Backend-as-a-Service
  - PostgreSQL database with Row Level Security (RLS)
  - Real-time subscriptions
  - Authentication & authorization
  - File storage for resumes and avatars
- **Next.js API Routes** - Serverless API endpoints

### Security & Performance

- **Row Level Security (RLS)** - Database-level access control
- **JWT Authentication** - Secure user sessions
- **Rate Limiting** - API protection against abuse
- **Input Validation & Sanitization** - XSS and injection prevention
- **Security Headers** - CSP, HSTS, and other security measures

### Development & Deployment

- **ESLint** - Code linting and quality
- **Vercel** - Production deployment and hosting
- **Git** - Version control

## Quick Start

### Prerequisites

- Node.js 18+ (recommended: 20+)
- npm or yarn
- Supabase account
- Git

### 1. Clone the Repository

```bash
git clone https://github.com/anshikasharmaa1517/Paper-Weight.git
cd Paper-Weight
```

### 2. Install Dependencies

```bash
npm install
# or
yarn install
```

### 3. Environment Setup

Create a `.env.local` file in the root directory:

```env
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key

# Admin Configuration
ADMIN_EMAILS=admin@example.com,admin2@example.com

# Optional: LinkedIn OAuth (for reviewer onboarding)
LINKEDIN_CLIENT_ID=your_linkedin_client_id
LINKEDIN_CLIENT_SECRET=your_linkedin_client_secret
```

### 4. Database Setup

1. **Create Supabase Project**:

   - Go to [supabase.com](https://supabase.com)
   - Create a new project
   - Copy your project URL and anon key

2. **Run Database Schema**:

   ```sql
   -- Execute the contents of supabase/schema.sql in your Supabase SQL editor
   ```

3. **Create Storage Buckets**:
   - In Supabase dashboard, go to Storage
   - Create buckets: `resumes` and `avatars`
   - Set appropriate RLS policies

### 5. Development Server

```bash
npm run dev
# or
yarn dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## 📁 Project Structure

```
paperweight/
├── app/                          # Next.js App Router
│   ├── (auth)/                   # Authentication pages
│   ├── (protected)/              # Protected routes
│   │   ├── admin/               # Admin dashboard
│   │   ├── creator/             # Reviewer dashboard
│   │   ├── dashboard/           # User dashboard
│   │   └── settings/            # User settings
│   ├── (public)/                # Public pages
│   │   ├── become-reviewer/     # Reviewer signup
│   │   └── r/[slug]/            # Public reviewer profiles
│   └── api/                     # API routes
├── components/                   # Reusable UI components
│   ├── ui/                      # Base UI components
│   ├── RoleGuard.tsx            # Route protection
│   └── OnboardingModal.tsx      # User onboarding
├── lib/                         # Utility libraries
│   ├── supabase.ts              # Supabase client
│   ├── roles.ts                 # Role management
│   ├── security.ts              # Security utilities
│   └── types.ts                 # TypeScript definitions
├── public/                      # Static assets
├── supabase/                    # Database schema
└── middleware.ts                # Next.js middleware
```

## Security Features

### Authentication & Authorization

- **JWT-based authentication** via Supabase Auth
- **Role-based access control** (User, Reviewer, Admin)
- **Route protection** with middleware
- **Session management** with automatic refresh

### Data Protection

- **Row Level Security (RLS)** on all database tables
- **Input validation** and sanitization
- **XSS protection** with Content Security Policy
- **SQL injection prevention** with parameterized queries

### API Security

- **Rate limiting** per IP and endpoint
- **Request validation** and error handling
- **Secure headers** (HSTS, X-Frame-Options, etc.)
- **Admin-only endpoints** with proper authorization

## Deployment

### Vercel Deployment

1. **Connect Repository**:

   - Link your GitHub repository to Vercel
   - Configure build settings

2. **Environment Variables**:

   - Add all required environment variables in Vercel dashboard
   - Ensure `NODE_ENV=production`

3. **Deploy**:
   ```bash
   git push origin main
   # Vercel will automatically deploy
   ```

### Environment Configuration

**Production Environment Variables**:

```env
NEXT_PUBLIC_SUPABASE_URL=your_production_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_production_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_production_service_role_key
ADMIN_EMAILS=admin@yourdomain.com
NODE_ENV=production
```

## Database Schema

### Core Tables

- **`profiles`** - User profiles with roles and onboarding status
- **`reviewers`** - Reviewer-specific information and public profiles
- **`resumes`** - Resume uploads and review status
- **`conversations`** - Real-time messaging between users and reviewers
- **`experiences`** - Reviewer professional experience
- **`reviewer_ratings`** - User ratings for reviewers

### Key Relationships

- Users have profiles with roles (user/reviewer/admin)
- Reviewers have detailed profiles with expertise areas
- Resumes are linked to users and reviewers
- Conversations connect users with reviewers
- Ratings track reviewer performance

## 🔧 Configuration

### Role Management

The platform supports three user roles:

- **User**: Can upload resumes, find reviewers, send messages
- **Reviewer**: Can review resumes, manage profile, respond to messages
- **Admin**: Full platform access, user management, analytics

### File Upload

- **Resume Storage**: Secure PDF upload to Supabase Storage
- **File Validation**: Type and size restrictions
- **Preview Support**: Client-side PDF preview
- **Access Control**: RLS policies for file access

## Testing

### Manual Testing Checklist

- [ ] User registration and authentication
- [ ] Resume upload and preview
- [ ] Reviewer profile creation
- [ ] Review process workflow
- [ ] Real-time messaging
- [ ] Role-based access control
- [ ] File upload security
- [ ] API rate limiting

### Security Testing

- [ ] Authentication bypass attempts
- [ ] SQL injection testing
- [ ] XSS vulnerability scanning
- [ ] File upload security
- [ ] Rate limiting effectiveness

## Future Improvements

### Short-term (Next 3 months)

- **Email Notifications**: Automated email alerts for reviews and messages
- **Mobile App**: React Native mobile application
- **Advanced Search**: Filter reviewers by expertise, location, availability
- **Review Templates**: Pre-built feedback templates for common issues
- **Analytics Dashboard**: Detailed usage and performance metrics

### Medium-term (3-6 months)

- **Video Reviews**: Video feedback from reviewers
- **AI-Powered Suggestions**: AI-generated resume improvement suggestions
- **Integration APIs**: LinkedIn, Indeed, and other job platform integrations
- **Payment System**: Premium features and reviewer compensation
- **Advanced Matching**: ML-based reviewer-user matching

### Long-term (6+ months)

- **Enterprise Features**: Company-wide resume review programs
- **API Platform**: Public API for third-party integrations
- **Multi-language Support**: Internationalization and localization
- **Advanced Analytics**: Predictive analytics and insights
- **White-label Solution**: Customizable platform for organizations


