# Blood Donation Management System (BDMS)

A comprehensive, cross-platform mobile application for managing blood donations, connecting donors with recipients, and streamlining blood request operations.

## 📋 Table of Contents

- [Overview](#overview)
- [Features](#features)
- [Technology Stack](#technology-stack)
- [System Requirements](#system-requirements)
- [Quick Start](#quick-start)
- [Project Structure](#project-structure)
- [Architecture](#architecture)
- [User Roles](#user-roles)
- [Core Modules](#core-modules)
- [API Documentation](#api-documentation)
- [Security](#security)
- [Contributing](#contributing)
- [License](#license)

## 🎯 Overview

The Blood Donation Management System (BDMS) is a modern, full-stack mobile application designed to bridge the gap between blood donors and recipients. The system provides real-time blood request management, donor matching, location-based services, and comprehensive administrative controls.

### Key Objectives

- **Connect Donors & Recipients**: Real-time matching based on blood group and location
- **Streamline Operations**: Automated workflows for blood requests and donations
- **Ensure Accountability**: Comprehensive audit logging and activity tracking
- **Enhance User Experience**: Intuitive interfaces for all user roles
- **Maintain Data Security**: Role-based access control and secure authentication

## ✨ Features

### For Donors
- 📱 Real-time blood request notifications
- 🎯 Location-based request matching
- 📊 Donation history and statistics
- ⏰ Eligibility tracking (90-day rule)
- 🔔 Push notifications for new requests
- 👤 Profile management with verification
- 🗺️ Live tracking during donation process

### For Recipients (Blood Request Users)
- 🩸 Create blood requests with urgency levels
- 📍 Location-based donor search
- 🔄 Real-time request status tracking
- 📋 View matched donors
- ⭐ Rate donation experiences
- 📱 Notification updates on request progress

### For Administrators
- 👥 User management (approve, deactivate, activate)
- 📊 System-wide analytics and statistics
- 📝 Comprehensive audit logs
- 🔍 Monitor all blood requests
- 📬 Notification management
- 🛡️ Security and access control
- 📈 Real-time activity dashboard

## 🛠️ Technology Stack

### Frontend
- **React Native** 0.81.5 - Cross-platform mobile framework
- **Expo** ~54.0 - Development and build tooling
- **TypeScript** 5.9.2 - Type-safe development
- **React Navigation** 7.x - Screen navigation
- **React Native Maps** 1.20.1 - Location and mapping
- **Async Storage** 2.2.0 - Local data persistence

### Backend
- **Node.js** - Runtime environment
- **Express** 4.18.2 - Web framework
- **SQLite3** 5.1.7 - Embedded database
- **Nodemailer** 7.0.11 - Email verification service
- **CORS** 2.8.5 - Cross-origin resource sharing

### Additional Services
- **OpenStreetMap (OSM)** - Map data and geocoding
- **Photon API** - Location search and autocomplete

## 💻 System Requirements

### Development Environment
- **Node.js**: 18.x or higher
- **npm**: 9.x or higher
- **Expo CLI**: Latest version
- **Operating System**: Windows 10/11, macOS 12+, or Linux

### Testing Devices
- **Android**: 8.0 (Oreo) or higher
- **iOS**: 13.0 or higher
- **Web**: Modern browsers (Chrome, Firefox, Safari, Edge)

### Network
- **Backend**: Port 3000 must be available
- **Frontend**: Port 8081 (Metro Bundler)
- **Internet**: Required for email verification and map services

## 🚀 Quick Start

### Prerequisites
Ensure you have Node.js and npm installed. Check versions:
```bash
node --version  # Should be 18.x or higher
npm --version   # Should be 9.x or higher
```

### Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd BDMS
   ```

2. **Install frontend dependencies**
   ```bash
   npm install
   ```

3. **Install backend dependencies**
   ```bash
   cd backend
   npm install
   cd ..
   ```

4. **Start the backend server**
   ```bash
   cd backend
   node server.js
   ```
   
   Expected output:
   ```
   🚀 Email service running on port 3000
   💾 Using SQLite database
   ✅ Connected to SQLite database
   ✅ All tables created successfully
   ```

5. **Start the frontend** (in a new terminal)
   ```bash
   npm start
   ```
   
   Then choose your platform:
   - Press `w` for Web
   - Press `a` for Android (requires emulator or device)
   - Press `i` for iOS (requires Xcode on macOS)

### Default Credentials

**Administrator Account:**
- Email: `admin@bdms.com`
- Password: `admin123`

**Note**: Change the default admin password after first login.

For detailed installation instructions, see [STARTUP-GUIDE.md](STARTUP-GUIDE.md).

## 📁 Project Structure

```
BDMS/
├── backend/                    # Backend server
│   ├── server.js              # Express server with all APIs
│   ├── bdms.db                # SQLite database
│   └── package.json           # Backend dependencies
│
├── src/                       # Frontend source code
│   ├── components/            # Reusable UI components
│   │   ├── Button.tsx
│   │   ├── Card.tsx
│   │   ├── CustomAlert.tsx
│   │   ├── LiveTrackingMap.tsx
│   │   └── LocationMapPicker.tsx
│   │
│   ├── constants/             # App-wide constants
│   │   ├── bloodTypes.ts
│   │   ├── colors.ts
│   │   └── config.ts
│   │
│   ├── context/               # Global state management
│   │   ├── AuthContext.tsx
│   │   ├── AlertContext.tsx
│   │   └── BloodRequestContext.tsx
│   │
│   ├── hooks/                 # Custom React hooks
│   │   ├── useAuth.ts
│   │   ├── useBloodRequests.ts
│   │   └── useGeolocation.ts
│   │
│   ├── navigation/            # Navigation configuration
│   │   ├── AppNavigator.tsx
│   │   ├── DonorNavigator.tsx
│   │   ├── RecipientNavigator.tsx
│   │   └── types.ts
│   │
│   ├── screens/               # Application screens
│   │   ├── admin/            # Admin-specific screens
│   │   ├── auth/             # Authentication screens
│   │   ├── donor/            # Donor-specific screens
│   │   ├── shared/           # Shared screens
│   │   └── user/             # Recipient screens
│   │
│   ├── services/              # API and external services
│   │   ├── api/              # API modules
│   │   ├── storage/          # Storage utilities
│   │   ├── auditLogService.ts
│   │   ├── notificationService.ts
│   │   └── osmApi.ts
│   │
│   ├── types/                 # TypeScript type definitions
│   │   ├── api.types.ts
│   │   ├── auditLog.types.ts
│   │   ├── notification.types.ts
│   │   └── user.types.ts
│   │
│   └── utils/                 # Helper utilities
│       ├── formatters.ts
│       ├── shadowStyles.ts
│       └── validation.ts
│
├── App.tsx                    # Root component
├── package.json               # Frontend dependencies
└── tsconfig.json             # TypeScript configuration
```

## 🏗️ Architecture

### Design Pattern
The application follows a **layered architecture** with clear separation of concerns:

```
┌─────────────────────────────────────────┐
│           Presentation Layer            │
│  (React Native Components & Screens)    │
└─────────────────┬───────────────────────┘
                  │
┌─────────────────▼───────────────────────┐
│          Business Logic Layer           │
│    (Context API, Custom Hooks)          │
└─────────────────┬───────────────────────┘
                  │
┌─────────────────▼───────────────────────┐
│           Service Layer                 │
│   (API Services, External Services)     │
└─────────────────┬───────────────────────┘
                  │
┌─────────────────▼───────────────────────┐
│            Data Layer                   │
│  (Backend APIs, SQLite Database)        │
└─────────────────────────────────────────┘
```

### Key Architectural Decisions

1. **Context API for State Management**: Global state accessible throughout the app
2. **TypeScript for Type Safety**: Catch errors at compile-time
3. **Service Layer Abstraction**: Decoupled API calls from UI components
4. **Role-Based Navigation**: Dynamic routing based on user role
5. **SQLite for Data Persistence**: Lightweight, embedded database

## 👥 User Roles

### 1. Administrator
**Access Level**: Full system control

**Capabilities**:
- View and manage all users
- Approve/reject user registrations
- Activate/deactivate accounts
- Monitor all blood requests
- Access audit logs
- View system-wide statistics
- Manage notifications

### 2. Donor
**Access Level**: Donation management

**Capabilities**:
- View available blood requests
- Accept blood requests
- Track donation history
- Update profile and blood group
- Manage notification preferences
- View eligibility status

### 3. Recipient (Blood Request User)
**Access Level**: Request management

**Capabilities**:
- Create blood requests
- Track request status
- View matched donors
- Rate donation experiences
- Manage request locations
- Cancel requests

## 🔧 Core Modules

### 1. Authentication & Authorization
- Secure login and registration
- Email verification
- Role-based access control (RBAC)
- Session management
- Password change with verification

### 2. Blood Request Management
- Create requests with blood group, urgency, location
- Automated donor matching based on:
  - Blood type compatibility
  - Geographic proximity
  - Donor eligibility (90-day rule)
- Real-time status updates
- Request lifecycle: OPEN → ACCEPTED → COMPLETED

### 3. Donor Management
- Profile registration and verification
- Donation history tracking
- Eligibility calculation
- Live location sharing during donation
- Notification preferences

### 4. Notification System
- Real-time push notifications
- Categorized notifications:
  - Blood requests
  - Profile updates
  - Request status changes
  - Admin actions
- Unread count tracking
- Mark as read/unread functionality

### 5. Audit Logging
- Automatic logging of critical actions:
  - User login/logout
  - Blood request creation
  - Donor accepts request
  - Request completion
  - Admin user management actions
- Filterable by action type, role, and date
- Chronological activity feed

### 6. Location Services
- Map-based location selection
- Geocoding and reverse geocoding
- Distance calculation
- Live tracking during donation

### 7. Admin Dashboard
- Real-time statistics:
  - Total users, donors, recipients
  - Active and completed requests
  - Recent system activities
- User management interface
- Audit log viewer
- Notification management

## 📡 API Documentation

### Base URL
```
http://localhost:3000/api
```

### Authentication Endpoints

#### Register User
```http
POST /auth/register
Content-Type: application/json

{
  "name": "John Doe",
  "email": "john@example.com",
  "password": "securePassword123",
  "role": "donor",
  "phone": "+1234567890"
}
```

#### Login
```http
POST /auth/login
Content-Type: application/json

{
  "email": "john@example.com",
  "password": "securePassword123"
}
```

### Blood Request Endpoints

#### Create Blood Request
```http
POST /blood-requests
Content-Type: application/json

{
  "userId": "user_123",
  "bloodGroup": "O+",
  "urgency": "urgent",
  "units": 2,
  "location": "Hospital Name, City",
  "latitude": 40.7128,
  "longitude": -74.0060,
  "notes": "Needed for surgery"
}
```

#### Get All Requests
```http
GET /blood-requests
```

#### Accept Request (Donor)
```http
POST /blood-requests/:requestId/accept
Content-Type: application/json

{
  "donorId": "donor_123"
}
```

### User Management Endpoints (Admin)

#### Get All Users
```http
GET /admin/users
```

#### Activate/Deactivate User
```http
PUT /admin/users/:userId/status
Content-Type: application/json

{
  "isActive": true,
  "action": "activate"
}
```

### Notification Endpoints

#### Get User Notifications
```http
GET /notifications/:userId
```

#### Mark as Read
```http
PUT /notifications/:notificationId/read
```

### Audit Log Endpoints (Admin)

#### Get Audit Logs
```http
GET /audit-logs?limit=50
```

For complete API documentation, see the backend server.js file.

## 🔒 Security

### Authentication
- Password hashing (production ready)
- Session management with tokens
- Email verification for critical actions

### Authorization
- Role-based access control (RBAC)
- Navigation guards
- API endpoint protection

### Data Protection
- SQL injection prevention (parameterized queries)
- CORS configuration
- Input validation and sanitization

### Best Practices
- Secure password policies
- Audit logging for accountability
- Regular security updates

## 🧪 Testing

### Test Admin Account
```
Email: admin@bdms.com
Password: admin123
```

### Creating Test Data

1. **Register as Donor**:
   - Use Register screen
   - Select "Donor" role
   - Complete profile with blood group

2. **Register as Recipient**:
   - Use Register screen
   - Select "User" role
   - Create blood requests

3. **Admin Operations**:
   - Login as admin
   - Approve/reject registrations
   - Monitor system activities

## 🐛 Troubleshooting

### Backend Connection Issues
- Ensure backend is running on port 3000
- Check firewall settings
- Verify IP address in `src/services/api.ts`

### Database Issues
- Delete `backend/bdms.db` to reset database
- Restart backend to recreate tables
- Check console for SQL errors

### App Crashes
- Clear Metro bundler cache: `npm start --reset-cache`
- Reinstall dependencies: `rm -rf node_modules && npm install`
- Check for TypeScript errors: `npx tsc --noEmit`

## 📈 Future Enhancements

- [ ] Blood bank inventory management
- [ ] Blood drive event scheduling
- [ ] SMS notifications
- [ ] Multi-language support
- [ ] Advanced analytics and reporting
- [ ] Integration with hospital systems
- [ ] Blockchain for donation tracking
- [ ] AI-based donor recommendation

## 🤝 Contributing

Contributions are welcome! Please follow these guidelines:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 📞 Support

For support and queries:
- Create an issue in the repository
- Contact: support@bdms.com

---

**Built with ❤️ for saving lives through efficient blood donation management**
