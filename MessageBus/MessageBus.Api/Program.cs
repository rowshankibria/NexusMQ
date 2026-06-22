using MessageBus.Api.BackgroundServices;
using MessageBus.Api.Data;
using MessageBus.Api.Hubs;
using MessageBus.Api.Middleware;
using MessageBus.Api.Repositories;
using MessageBus.Api.Repositories.Interfaces;
using MessageBus.Api.Services;
using MessageBus.Api.Services.Interfaces;
using Microsoft.Data.SqlClient;
using Microsoft.EntityFrameworkCore;
using Microsoft.OpenApi.Models;
using System.Reflection;

var builder = WebApplication.CreateBuilder(args);

// Add controllers with XML documentation
builder.Services.AddControllers();

// Add Swagger/OpenAPI with configuration
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen(options =>
{
    options.SwaggerDoc("v1", new OpenApiInfo
    {
        Version = "v1",
        Title = "MessageBus API",
        Description = "Service Broker Message Bus Management API - Monitor, manage, and debug SQL Server Service Broker queues, messages, and conversations.",
        Contact = new OpenApiContact
        {
            Name = "Con Edison Development Team"
        }
    });

    // Add API Key authentication to Swagger
    options.AddSecurityDefinition("ApiKey", new OpenApiSecurityScheme
    {
        Description = "API Key authentication. Enter your API key in the text box below.",
        Name = "X-API-Key",
        In = ParameterLocation.Header,
        Type = SecuritySchemeType.ApiKey,
        Scheme = "ApiKeyScheme"
    });

    options.AddSecurityRequirement(new OpenApiSecurityRequirement
    {
        {
            new OpenApiSecurityScheme
            {
                Reference = new OpenApiReference
                {
                    Type = ReferenceType.SecurityScheme,
                    Id = "ApiKey"
                },
                In = ParameterLocation.Header
            },
            new List<string>()
        }
    });

    // Include XML documentation from assembly
    var xmlFilename = $"{Assembly.GetExecutingAssembly().GetName().Name}.xml";
    var xmlPath = Path.Combine(AppContext.BaseDirectory, xmlFilename);
    if (File.Exists(xmlPath))
    {
        options.IncludeXmlComments(xmlPath);
    }

    // Custom schema IDs to avoid conflicts
    options.CustomSchemaIds(type => type.FullName?.Replace("+", "."));
});

// Add SignalR
builder.Services.AddSignalR();

// Add CORS
builder.Services.AddCors(options =>
{
    options.AddPolicy("AllowAngularDev", policy =>
    {
        policy.WithOrigins("http://localhost:4200")
              .AllowAnyHeader()
              .AllowAnyMethod()
              .AllowCredentials();
    });

    options.AddPolicy("AllowAll", policy =>
    {
        policy.AllowAnyOrigin()
              .AllowAnyHeader()
              .AllowAnyMethod();
    });
});

// Register SQL connection string for dependency injection (for legacy code)
builder.Services.AddScoped<SqlConnection>(sp =>
{
    var connectionString = builder.Configuration.GetConnectionString("MessageBusDb");
    return new SqlConnection(connectionString);
});

// Register Entity Framework Core DbContext
builder.Services.AddDbContext<MessageBusDbContext>(options =>
    options.UseSqlServer(builder.Configuration.GetConnectionString("MessageBusDb")));

// Register repositories
builder.Services.AddScoped<IHealthRepository, HealthRepository>();
builder.Services.AddScoped<IQueueRepository, QueueRepository>();
builder.Services.AddScoped<IMessageRepository, MessageRepository>();
builder.Services.AddScoped<IServiceRepository, ServiceRepository>();
builder.Services.AddScoped<IPoisonMessageRepository, PoisonMessageRepository>();
builder.Services.AddScoped<IConversationRepository, ConversationRepository>();
builder.Services.AddScoped<IDiagnosticsRepository, DiagnosticsRepository>();
builder.Services.AddScoped<IApplicationRepository, ApplicationRepository>();

// Register services
builder.Services.AddScoped<IHealthService, HealthService>();
builder.Services.AddScoped<IQueueService, QueueService>();
builder.Services.AddScoped<IMessageService, MessageService>();
builder.Services.AddScoped<IPoisonMessageService, PoisonMessageService>();
builder.Services.AddScoped<IConversationService, ConversationService>();
builder.Services.AddScoped<IDiagnosticsService, DiagnosticsService>();
builder.Services.AddScoped<IAlertService, AlertService>();
builder.Services.AddScoped<IApplicationService, ApplicationService>();

// Register background services
builder.Services.AddHostedService<HealthMonitorService>();
builder.Services.AddHostedService<MetricsCollectionService>();

var app = builder.Build();

// Configure the HTTP request pipeline
if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI(options =>
    {
        options.SwaggerEndpoint("/swagger/v1/swagger.json", "MessageBus API v1");
        options.RoutePrefix = "swagger";
        options.DocumentTitle = "MessageBus API Documentation";
        options.EnableDeepLinking();
        options.DisplayRequestDuration();
    });
}

// Use CORS (must be before routing)
app.UseCors("AllowAngularDev");

app.UseRouting();

// API Key authentication middleware
app.UseApiKeyAuth();

app.UseAuthorization();

// Map controllers
app.MapControllers();

// Map SignalR hubs
app.MapHub<MessageBusHub>("/hubs/messagebus");

app.Run();
