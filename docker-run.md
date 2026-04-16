# Docker Setup and Run Guide

This guide provides comprehensive instructions for setting up and running the Sales Dashboard application using Docker and Docker Compose.

## Prerequisites

Before you begin, ensure you have the following installed on your system:

- **Docker**: Version 20.10 or later
- **Docker Compose**: Version 2.0 or later
- **Git**: For cloning the repository

You can check your versions with:
```bash
docker --version
docker-compose --version
```

## Project Structure

```
sales-dashboard-app/
├── backend-api/          # Django REST API backend
│   ├── Dockerfile       # Backend Docker configuration
│   ├── .env            # Backend environment variables
│   └── ...
├── frontend/            # React frontend
│   ├── Dockerfile      # Frontend Docker configuration
│   ├── nginx.conf      # Nginx configuration
│   ├── .env           # Frontend environment variables
│   └── ...
├── docker-compose.yml   # Docker Compose configuration
└── docker-run.md       # This file
```

## Quick Start

### 1. Clone the Repository

```bash
git clone <your-repository-url>
cd sales-dashboard-app
```

### 2. Environment Configuration

Before running the application, configure the environment variables:

#### Backend Environment (.env)
Update `backend-api/.env` with your production values:

```bash
# Django settings
SECRET_KEY=your-production-secret-key-here
DEBUG=False
ALLOWED_HOSTS=yourdomain.com,www.yourdomain.com

# Database settings
DB_NAME=sales_dashboard_db
DB_USER=sales_user
DB_PASSWORD=your_db_password
DB_HOST=localhost
DB_PORT=5432

# JWT settings
JWT_ACCESS_TOKEN_EXPIRE_MINUTES=60
JWT_REFRESH_TOKEN_EXPIRE_DAYS=7
JWT_SECRET_KEY=your-jwt-secret-key-here

# CORS settings
CORS_ALLOWED_ORIGINS=https://yourdomain.com,https://www.yourdomain.com

# Activity logging
ACTIVITY_LOG_ENABLED=True

# Pagination
PAGINATION_DEFAULT_SIZE=10
```

#### Frontend Environment (.env)
Update `frontend/.env` with your frontend configuration:

```bash
# Frontend Environment Variables

# API Configuration
VITE_API_BASE_URL=https://api.yourdomain.com

# App Configuration
VITE_APP_TITLE=Sales Dashboard
VITE_APP_VERSION=1.0.0

# Environment
VITE_NODE_ENV=production
```

### 3. Build and Run with Docker Compose

```bash
# Build and start all services
docker-compose up --build

# Or run in detached mode (background)
docker-compose up --build -d
```

### 4. Access the Application

- **Frontend**: http://localhost (or your configured domain)
- **Backend API**: http://localhost:8000
- **Database**: localhost:5432 (PostgreSQL)

## Detailed Docker Commands

### Development Mode

For development with hot reloading:

```bash
# Start services in development mode
docker-compose -f docker-compose.dev.yml up --build
```

### Production Mode

For production deployment:

```bash
# Build for production
docker-compose up --build -d

# View running containers
docker-compose ps

# View logs
docker-compose logs -f

# Stop services
docker-compose down

# Stop and remove volumes
docker-compose down -v
```

### Individual Service Management

```bash
# Start only backend
docker-compose up backend --build

# Start only frontend
docker-compose up frontend --build

# Start only database
docker-compose up db

# Rebuild specific service
docker-compose up --build backend
```

## Database Setup

The PostgreSQL database is automatically created when you run `docker-compose up`. However, you may need to run migrations manually:

```bash
# Run Django migrations
docker-compose exec backend python manage.py migrate

# Create superuser
docker-compose exec backend python manage.py createsuperuser

# Collect static files
docker-compose exec backend python manage.py collectstatic --noinput
```

## Troubleshooting

### Common Issues

#### 1. Port Conflicts
If ports 80, 443, or 5432 are already in use:
```bash
# Check what's using the ports
sudo lsof -i :80
sudo lsof -i :443
sudo lsof -i :5432

# Stop conflicting services or change ports in docker-compose.yml
```

#### 2. Database Connection Issues
```bash
# Check database logs
docker-compose logs db

# Restart database
docker-compose restart db

# Reset database (WARNING: This will delete all data)
docker-compose down -v
docker-compose up db -d
```

#### 3. Permission Issues
```bash
# Fix file permissions
sudo chown -R $USER:$USER .

# If using Docker Desktop on Windows/Mac, ensure file sharing is enabled
```

#### 4. Build Failures
```bash
# Clear Docker cache
docker system prune -a

# Rebuild without cache
docker-compose build --no-cache

# Check build logs
docker-compose build --progress=plain
```

### Logs and Debugging

```bash
# View all logs
docker-compose logs

# View specific service logs
docker-compose logs backend
docker-compose logs frontend
docker-compose logs db

# Follow logs in real-time
docker-compose logs -f

# View last 100 lines
docker-compose logs --tail=100
```

### Container Shell Access

```bash
# Access backend container
docker-compose exec backend bash

# Access frontend container
docker-compose exec frontend sh

# Access database
docker-compose exec db psql -U dashboard_user -d sales_dashboard_db
```

## Environment Variables Reference

### Backend (.env)
- `SECRET_KEY`: Django secret key (generate a new one for production)
- `DEBUG`: Set to `False` for production
- `ALLOWED_HOSTS`: Comma-separated list of allowed hostnames
- `DB_*`: Database connection settings
- `JWT_*`: JWT token configuration
- `CORS_ALLOWED_ORIGINS`: Allowed CORS origins

### Frontend (.env)
- `VITE_API_BASE_URL`: Backend API URL
- `VITE_APP_TITLE`: Application title
- `VITE_APP_VERSION`: Application version
- `VITE_NODE_ENV`: Environment (development/production)

## Production Deployment

For production deployment:

1. Update all environment variables with production values
2. Use a reverse proxy (nginx) in front of the containers
3. Set up SSL certificates
4. Configure proper logging and monitoring
5. Use environment-specific docker-compose files

### Example Production docker-compose.prod.yml

```yaml
version: '3.8'

services:
  # ... same as main docker-compose.yml but with production settings

  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx/prod.conf:/etc/nginx/conf.d/default.conf
      - ./ssl:/etc/ssl/certs
    depends_on:
      - frontend
      - backend
```

## Performance Optimization

### Docker Best Practices

1. **Use Multi-stage Builds**: Already implemented in Dockerfiles
2. **Optimize Layer Caching**: Order COPY commands appropriately
3. **Use .dockerignore**: Exclude unnecessary files
4. **Minimize Image Size**: Use alpine images where possible

### Application Performance

1. **Database Indexing**: Ensure proper indexes on frequently queried fields
2. **Caching**: Implement Redis for session and cache storage
3. **Static Files**: Served directly by nginx
4. **Gzip Compression**: Enabled in nginx configuration

## Security Considerations

1. **Environment Variables**: Never commit secrets to version control
2. **Network Security**: Use internal networks for inter-service communication
3. **Updates**: Regularly update base images for security patches
4. **Secrets Management**: Use Docker secrets or external secret managers
5. **Firewall**: Configure firewall rules appropriately

## Monitoring and Maintenance

### Health Checks

```bash
# Check container health
docker-compose ps

# Health check endpoint
curl http://localhost/health
```

### Backup and Restore

```bash
# Backup database
docker-compose exec db pg_dump -U dashboard_user sales_dashboard_db > backup.sql

# Restore database
docker-compose exec -T db psql -U dashboard_user -d sales_dashboard_db < backup.sql
```

### Updates

```bash
# Update images
docker-compose pull

# Rebuild and restart
docker-compose up --build -d
```

## Support

If you encounter issues:

1. Check the logs: `docker-compose logs`
2. Verify environment variables are set correctly
3. Ensure all required ports are available
4. Check Docker and Docker Compose versions
5. Review the troubleshooting section above

For additional help, refer to the project documentation or create an issue in the repository.