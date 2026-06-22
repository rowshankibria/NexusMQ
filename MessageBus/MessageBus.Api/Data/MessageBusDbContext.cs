using MessageBus.Api.Models;
using Microsoft.EntityFrameworkCore;

namespace MessageBus.Api.Data;

/// <summary>
/// DbContext for Service Broker Message Bus database operations.
/// Uses keyless entities for stored procedure result sets.
/// </summary>
public class MessageBusDbContext : DbContext
{
    public MessageBusDbContext(DbContextOptions<MessageBusDbContext> options) : base(options)
    {
    }

    // Queue-related entities
    public DbSet<QueueInfo> QueueInfos { get; set; } = null!;
    public DbSet<QueueStatistics> QueueStatistics { get; set; } = null!;

    // Message-related entities
    public DbSet<MessageInfo> MessageInfos { get; set; } = null!;
    public DbSet<SendMessageResult> SendMessageResults { get; set; } = null!;
    public DbSet<ReceiveMessageResult> ReceiveMessageResults { get; set; } = null!;

    // Poison/Dead Letter entities
    public DbSet<PoisonMessageInfo> PoisonMessageInfos { get; set; } = null!;
    public DbSet<DeadLetterMessage> DeadLetterMessages { get; set; } = null!;

    // Conversation entities
    public DbSet<ConversationInfo> ConversationInfos { get; set; } = null!;
    public DbSet<ConversationTraceItem> ConversationTraceItems { get; set; } = null!;

    // Diagnostics entities
    public DbSet<TransmissionQueueItem> TransmissionQueueItems { get; set; } = null!;
    public DbSet<TransmissionQueueSummary> TransmissionQueueSummaries { get; set; } = null!;
    public DbSet<DialogError> DialogErrors { get; set; } = null!;
    public DbSet<PerformanceMetric> PerformanceMetrics { get; set; } = null!;
    public DbSet<HealthCheckResult> HealthCheckResults { get; set; } = null!;
    public DbSet<BrokerStatus> BrokerStatuses { get; set; } = null!;
    public DbSet<ServiceBrokerHealthInfo> ServiceBrokerHealthInfos { get; set; } = null!;

    // Service/Contract entities
    public DbSet<ServiceInfo> ServiceInfos { get; set; } = null!;
    public DbSet<ContractInfo> ContractInfos { get; set; } = null!;
    public DbSet<MessageTypeInfo> MessageTypeInfos { get; set; } = null!;

    // Application registration entities
    public DbSet<Application> Applications { get; set; } = null!;

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);

        // Configure all entities as keyless (they come from stored procedures/views)

        // Queue-related entities
        modelBuilder.Entity<QueueInfo>().HasNoKey().ToView(null);
        modelBuilder.Entity<QueueStatistics>().HasNoKey().ToView(null);

        // Message-related entities
        modelBuilder.Entity<MessageInfo>().HasNoKey().ToView(null);
        modelBuilder.Entity<SendMessageResult>().HasNoKey().ToView(null);
        modelBuilder.Entity<ReceiveMessageResult>().HasNoKey().ToView(null);

        // Poison/Dead Letter entities
        modelBuilder.Entity<PoisonMessageInfo>().HasNoKey().ToView(null);
        // DeadLetterMessage has a key (Id) since it maps to an actual table
        modelBuilder.Entity<DeadLetterMessage>()
            .HasKey(d => d.Id);
        modelBuilder.Entity<DeadLetterMessage>()
            .ToTable("DeadLetterQueue", "dbo");

        // Conversation entities
        modelBuilder.Entity<ConversationInfo>().HasNoKey().ToView(null);
        modelBuilder.Entity<ConversationTraceItem>().HasNoKey().ToView(null);

        // Diagnostics entities
        modelBuilder.Entity<TransmissionQueueItem>().HasNoKey().ToView(null);
        modelBuilder.Entity<TransmissionQueueSummary>().HasNoKey().ToView(null);
        modelBuilder.Entity<DialogError>().HasNoKey().ToView(null);
        modelBuilder.Entity<PerformanceMetric>().HasNoKey().ToView(null);
        modelBuilder.Entity<HealthCheckResult>().HasNoKey().ToView(null);
        modelBuilder.Entity<BrokerStatus>().HasNoKey().ToView(null);
        modelBuilder.Entity<ServiceBrokerHealthInfo>().HasNoKey().ToView(null);

        // Service/Contract entities
        modelBuilder.Entity<ServiceInfo>().HasNoKey().ToView(null);
        modelBuilder.Entity<ContractInfo>().HasNoKey().ToView(null);
        modelBuilder.Entity<MessageTypeInfo>().HasNoKey().ToView(null);

        // Application registration entity (keyed - maps to actual table)
        modelBuilder.Entity<Application>()
            .HasKey(a => a.Id);
        modelBuilder.Entity<Application>()
            .ToTable("Applications", "dbo");
        modelBuilder.Entity<Application>()
            .HasIndex(a => a.ApiKey)
            .IsUnique();
        modelBuilder.Entity<Application>()
            .Property(a => a.ApiKey)
            .HasMaxLength(64);
        modelBuilder.Entity<Application>()
            .Property(a => a.Name)
            .HasMaxLength(100);
    }
}
