# Service Broker Message Bus - Development Environment Setup

This guide covers setting up your local development environment for the Service Broker Message Bus application.

## Prerequisites

### Required Software

| Software | Minimum Version | Download Link |
|----------|----------------|---------------|
| Node.js | 18.x or higher | https://nodejs.org/ |
| npm | 9.x or higher | (included with Node.js) |
| .NET SDK | 8.0 | https://dotnet.microsoft.com/download/dotnet/8.0 |
| SQL Server | 2019+ or Express | https://www.microsoft.com/sql-server/sql-server-downloads |
| SQL Server Management Studio | 18.x+ | https://learn.microsoft.com/sql/ssms/download-sql-server-management-studio-ssms |
| Git | 2.x | https://git-scm.com/downloads |
| Visual Studio Code (optional) | Latest | https://code.visualstudio.com/ |

### Verify Installation

```powershell
# Check Node.js
node --version

# Check npm
npm --version

# Check .NET SDK
dotnet --version

# Check Git
git --version
```

## Clone and Setup

### 1. Clone Repository

```powershell
cd D:\Workstations\Developments\Con-Edison\Applications
git clone <repository-url> MessageBus
cd MessageBus
```

### 2. Project Structure

```
MessageBus/
├── Database/                    # SQL scripts for database setup
│   ├── 00-EnableServiceBroker.sql
│   ├── 01-CreateMessageTypes.sql
│   ├── ...
│   └── 99-VerifyAllObjects.sql
├── MessageBus.Api/              # .NET 8 Web API
│   ├── Controllers/
│   ├── Services/
│   ├── Repositories/
│   ├── Models/
│   └── appsettings.json
├── MessageBus.Client/           # .NET Client Library
├── messagebus-client/           # npm/TypeScript Client Library
└── messagebus-ui/               # Angular 18 Frontend
    ├── src/
    │   ├── app/
    │   │   ├── core/
    │   │   ├── shared/
    │   │   └── features/
    │   └── environments/
    └── angular.json
```

## Database Initialization

### 1. Create Database

```sql
-- Run in SQL Server Management Studio
CREATE DATABASE MessageBus;
GO

USE MessageBus;
GO
```

### 2. Run SQL Scripts in Order

Execute the scripts in the `Database/` folder in numerical order. Each script builds on the previous one.

```powershell
# Using sqlcmd (run from project root)
sqlcmd -S localhost -d MessageBus -i "Database\00-EnableServiceBroker.sql"
sqlcmd -S localhost -d MessageBus -i "Database\01-CreateMessageTypes.sql"
sqlcmd -S localhost -d MessageBus -i "Database\02-CreateContracts.sql"
sqlcmd -S localhost -d MessageBus -i "Database\03-CreateQueues.sql"
sqlcmd -S localhost -d MessageBus -i "Database\04-CreateServices.sql"
sqlcmd -S localhost -d MessageBus -i "Database\05-CreateActivationProcedure.sql"
sqlcmd -S localhost -d MessageBus -i "Database\06-EnableQueueActivation.sql"
sqlcmd -S localhost -d MessageBus -i "Database\07-TestServiceBroker.sql"
sqlcmd -S localhost -d MessageBus -i "Database\10-CreateDeadLetterQueue.sql"
sqlcmd -S localhost -d MessageBus -i "Database\11-CreateMessageAuditTrail.sql"
sqlcmd -S localhost -d MessageBus -i "Database\12-CreatePerformanceMetrics.sql"
sqlcmd -S localhost -d MessageBus -i "Database\13-CreateRegisteredApplications.sql"
sqlcmd -S localhost -d MessageBus -i "Database\14-CreateAlertTables.sql"
# Continue with remaining scripts (20-36, 40-45, 99)
```

**Or run all scripts using PowerShell:**

```powershell
$scripts = Get-ChildItem "Database\*.sql" | Sort-Object Name
foreach ($script in $scripts) {
    Write-Host "Executing: $($script.Name)"
    sqlcmd -S localhost -d MessageBus -i $script.FullName
}
```

### 3. Verify Database Setup

```sql
-- Run the verification script
USE MessageBus;
EXEC dbo.usp_VerifyAllObjects;

-- Or manually check
SELECT name FROM sys.service_message_types WHERE name LIKE 'MessageBus%';
SELECT name FROM sys.service_contracts WHERE name LIKE 'MessageBus%';
SELECT name FROM sys.services WHERE name LIKE 'MessageBus%';
SELECT * FROM sys.service_queues WHERE name NOT LIKE 'sys%';
```

## Backend API Setup

### 1. Configure Connection String

Edit `MessageBus.Api/appsettings.Development.json`:

```json
{
  "Logging": {
    "LogLevel": {
      "Default": "Debug",
      "Microsoft.AspNetCore": "Information"
    }
  },
  "ConnectionStrings": {
    "MessageBusDb": "Server=localhost;Database=MessageBus;Trusted_Connection=True;TrustServerCertificate=True;"
  }
}
```

**For SQL Server Authentication:**

```json
{
  "ConnectionStrings": {
    "MessageBusDb": "Server=localhost;Database=MessageBus;User Id=your_user;Password=your_password;TrustServerCertificate=True;"
  }
}
```

### 2. Restore NuGet Packages

```powershell
cd MessageBus.Api
dotnet restore
```

### 3. Build the API

```powershell
dotnet build
```

### 4. Run the API

```powershell
dotnet run
```

The API will start on:
- **HTTP:** http://localhost:5000
- **HTTPS:** https://localhost:5001

### 5. Verify API is Running

Open a browser or use curl:

```powershell
# Health check endpoint
curl http://localhost:5000/api/health

# Swagger UI
start http://localhost:5000/swagger
```

## Frontend UI Setup

### 1. Install npm Dependencies

```powershell
cd messagebus-ui
npm install
```

### 2. Configure API URL

Edit `src/environments/environment.development.ts`:

```typescript
export const environment = {
  production: false,
  apiUrl: 'http://localhost:5000/api'
};
```

### 3. Run Angular Development Server

```powershell
npm start
# or
ng serve
```

The UI will be available at: **http://localhost:4200**

### 4. Build for Production

```powershell
npm run build
# or
ng build --configuration production
```

Output will be in `dist/messagebus-ui/`.

## Environment Variables

### Backend (.NET)

| Variable | Description | Default |
|----------|-------------|---------|
| `ASPNETCORE_ENVIRONMENT` | Runtime environment | Development |
| `ASPNETCORE_URLS` | Server URLs | http://localhost:5000 |
| `ConnectionStrings__MessageBusDb` | Database connection | (see appsettings) |

**Set environment variables in PowerShell:**

```powershell
$env:ASPNETCORE_ENVIRONMENT = "Development"
$env:ASPNETCORE_URLS = "http://localhost:5000;https://localhost:5001"
```

### Frontend (Angular)

Angular uses build configurations in `angular.json`. Use the `--configuration` flag:

```powershell
# Development
ng serve --configuration=development

# Production
ng build --configuration=production

# Staging (after adding staging config)
ng build --configuration=staging
```

## IDE Setup (Optional)

### Visual Studio Code Extensions

Recommended extensions for this project:

```json
{
  "recommendations": [
    "ms-dotnettools.csharp",
    "ms-dotnettools.csdevkit",
    "angular.ng-template",
    "esbenp.prettier-vscode",
    "dbaeumer.vscode-eslint",
    "formulahendry.auto-rename-tag",
    "pkief.material-icon-theme"
  ]
}
```

### VS Code Launch Configuration

Create `.vscode/launch.json`:

```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "name": ".NET Core Launch (API)",
      "type": "coreclr",
      "request": "launch",
      "preLaunchTask": "build",
      "program": "${workspaceFolder}/MessageBus.Api/bin/Debug/net8.0/MessageBus.Api.dll",
      "args": [],
      "cwd": "${workspaceFolder}/MessageBus.Api",
      "stopAtEntry": false,
      "serverReadyAction": {
        "action": "openExternally",
        "pattern": "\\bNow listening on:\\s+(https?://\\S+)"
      },
      "env": {
        "ASPNETCORE_ENVIRONMENT": "Development"
      }
    }
  ]
}
```

## Running Both Applications

### Option 1: Separate Terminals

```powershell
# Terminal 1 - API
cd MessageBus.Api
dotnet run

# Terminal 2 - UI
cd messagebus-ui
npm start
```

### Option 2: Using VS Code Tasks

Create `.vscode/tasks.json`:

```json
{
  "version": "2.0.0",
  "tasks": [
    {
      "label": "Start API",
      "type": "shell",
      "command": "dotnet",
      "args": ["run"],
      "options": {
        "cwd": "${workspaceFolder}/MessageBus.Api"
      },
      "group": "build",
      "isBackground": true
    },
    {
      "label": "Start UI",
      "type": "shell",
      "command": "npm",
      "args": ["start"],
      "options": {
        "cwd": "${workspaceFolder}/messagebus-ui"
      },
      "group": "build",
      "isBackground": true
    },
    {
      "label": "Start All",
      "dependsOn": ["Start API", "Start UI"],
      "dependsOrder": "parallel"
    }
  ]
}
```

## Troubleshooting

### Common Issues

#### SQL Server Connection Failed

```
Error: Cannot connect to localhost
```

**Solution:** Ensure SQL Server is running and TCP/IP is enabled in SQL Server Configuration Manager.

#### Service Broker Not Enabled

```
Error: Service Broker is not enabled
```

**Solution:** Run the enable script:
```sql
ALTER DATABASE MessageBus SET ENABLE_BROKER WITH ROLLBACK IMMEDIATE;
```

#### Port Already in Use

```
Error: Port 5000 is already in use
```

**Solution:** Either stop the conflicting process or change the port in `launchSettings.json`:
```json
{
  "profiles": {
    "MessageBus.Api": {
      "applicationUrl": "http://localhost:5010"
    }
  }
}
```

#### Angular CLI Not Found

```
Error: 'ng' is not recognized
```

**Solution:** Install Angular CLI globally:
```powershell
npm install -g @angular/cli
```

#### CORS Errors in Browser

```
Error: Access-Control-Allow-Origin header missing
```

**Solution:** Ensure CORS is configured in the API. Check `Program.cs` includes:
```csharp
builder.Services.AddCors(options =>
{
    options.AddPolicy("Development", policy =>
    {
        policy.WithOrigins("http://localhost:4200")
              .AllowAnyHeader()
              .AllowAnyMethod()
              .AllowCredentials();
    });
});
```

### Getting Help

- Check existing issues in the repository
- Review API documentation at `/swagger`
- Consult the operational runbooks in `RUNBOOKS.md`

## Next Steps

After setup is complete:

1. Access the Dashboard at http://localhost:4200
2. Explore the Queue Explorer
3. Review the User Guide in `USER-GUIDE.md`
4. Test message sending functionality
5. Configure API keys for secure access
