/*
================================================================================
Script: 14-CreateAlertTables.sql
Purpose: Create AlertRules and AlertHistory tables for monitoring alerts
Phase: 0.5A - SQL Server Custom Tables
================================================================================
Prerequisites: Phase 0 scripts (00-07) must be run first
================================================================================
These tables manage alerting rules and their history for proactive monitoring
of Service Broker queue health and performance.
================================================================================
*/

USE [MessageBus]; -- Change to your target database name
GO

SET NOCOUNT ON;

PRINT '========================================';
PRINT 'Creating Alert Tables';
PRINT '========================================';
PRINT '';

-- ============================================================================
-- Table: AlertRules
-- Purpose: Define alerting rules for queue monitoring
-- ============================================================================
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = N'AlertRules' AND schema_id = SCHEMA_ID('dbo'))
BEGIN
    CREATE TABLE dbo.AlertRules (
        -- Primary key
        Id INT IDENTITY(1,1) PRIMARY KEY,

        -- Rule identification
        RuleName NVARCHAR(256) NOT NULL,
        RuleType NVARCHAR(50) NOT NULL, -- 'QUEUE_DEPTH', 'MESSAGE_AGE', 'POISON_MESSAGE', 'DISABLED_QUEUE'

        -- Target (NULL means all queues)
        QueueName NVARCHAR(256) NULL,

        -- Thresholds
        WarningThreshold INT NULL,
        CriticalThreshold INT NULL,

        -- Status
        IsEnabled BIT NOT NULL DEFAULT 1,

        -- Notification configuration (JSON)
        NotificationChannels NVARCHAR(MAX) NULL, -- e.g., '["email", "slack", "webhook"]'
        NotificationConfig NVARCHAR(MAX) NULL,   -- e.g., '{"email": "admin@example.com", "webhookUrl": "..."}'

        -- Cooldown to prevent alert spam
        CooldownMinutes INT NOT NULL DEFAULT 15,

        -- Audit fields
        CreatedAt DATETIME2 NOT NULL DEFAULT SYSDATETIME(),
        CreatedBy NVARCHAR(256) NULL DEFAULT SUSER_SNAME(),
        ModifiedAt DATETIME2 NULL,
        ModifiedBy NVARCHAR(256) NULL,

        -- Constraints
        CONSTRAINT CK_AlertRules_RuleType CHECK (
            RuleType IN ('QUEUE_DEPTH', 'MESSAGE_AGE', 'POISON_MESSAGE', 'DISABLED_QUEUE', 'TRANSMISSION_QUEUE', 'CONVERSATION_ERROR')
        ),

        -- Indexes
        INDEX IX_AlertRules_Enabled (IsEnabled) WHERE IsEnabled = 1,
        INDEX IX_AlertRules_Type (RuleType),
        INDEX IX_AlertRules_Queue (QueueName)
    );

    PRINT 'Created table: dbo.AlertRules';
END
ELSE
BEGIN
    PRINT 'Table already exists: dbo.AlertRules';
END
GO

-- ============================================================================
-- Table: AlertHistory
-- Purpose: Store history of triggered alerts
-- ============================================================================
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = N'AlertHistory' AND schema_id = SCHEMA_ID('dbo'))
BEGIN
    CREATE TABLE dbo.AlertHistory (
        -- Primary key
        Id BIGINT IDENTITY(1,1) PRIMARY KEY,

        -- Reference to the rule that triggered
        AlertRuleId INT NOT NULL,

        -- Alert details
        Severity NVARCHAR(20) NOT NULL, -- 'WARNING', 'CRITICAL'
        QueueName NVARCHAR(256) NOT NULL,
        CurrentValue INT NOT NULL,
        ThresholdValue INT NOT NULL,
        AlertMessage NVARCHAR(MAX) NOT NULL,

        -- Timestamps
        TriggeredAt DATETIME2 NOT NULL DEFAULT SYSDATETIME(),

        -- Acknowledgement
        AcknowledgedAt DATETIME2 NULL,
        AcknowledgedBy NVARCHAR(256) NULL,
        AcknowledgementNotes NVARCHAR(MAX) NULL,

        -- Resolution
        ResolvedAt DATETIME2 NULL,
        ResolvedBy NVARCHAR(256) NULL,
        ResolutionNotes NVARCHAR(MAX) NULL,

        -- Notification tracking
        NotificationSentAt DATETIME2 NULL,
        NotificationStatus NVARCHAR(50) NULL, -- 'SENT', 'FAILED', 'PENDING'
        NotificationError NVARCHAR(MAX) NULL,

        -- Constraints
        CONSTRAINT FK_AlertHistory_AlertRule FOREIGN KEY (AlertRuleId)
            REFERENCES dbo.AlertRules(Id) ON DELETE CASCADE,
        CONSTRAINT CK_AlertHistory_Severity CHECK (Severity IN ('WARNING', 'CRITICAL', 'INFO')),

        -- Indexes
        INDEX IX_AlertHistory_Triggered (TriggeredAt DESC),
        INDEX IX_AlertHistory_Rule (AlertRuleId, TriggeredAt DESC),
        INDEX IX_AlertHistory_Queue (QueueName, TriggeredAt DESC),
        INDEX IX_AlertHistory_Unacknowledged (TriggeredAt DESC) WHERE AcknowledgedAt IS NULL,
        INDEX IX_AlertHistory_Unresolved (TriggeredAt DESC) WHERE ResolvedAt IS NULL
    );

    PRINT 'Created table: dbo.AlertHistory';
END
ELSE
BEGIN
    PRINT 'Table already exists: dbo.AlertHistory';
END
GO

-- ============================================================================
-- Add extended properties for documentation
-- ============================================================================
IF NOT EXISTS (SELECT * FROM sys.extended_properties WHERE major_id = OBJECT_ID('dbo.AlertRules') AND name = 'MS_Description')
BEGIN
    EXEC sp_addextendedproperty
        @name = N'MS_Description',
        @value = N'Defines alerting rules for monitoring Service Broker queue health and performance.',
        @level0type = N'SCHEMA', @level0name = N'dbo',
        @level1type = N'TABLE', @level1name = N'AlertRules';
END

IF NOT EXISTS (SELECT * FROM sys.extended_properties WHERE major_id = OBJECT_ID('dbo.AlertHistory') AND name = 'MS_Description')
BEGIN
    EXEC sp_addextendedproperty
        @name = N'MS_Description',
        @value = N'Stores history of all triggered alerts including acknowledgement and resolution tracking.',
        @level0type = N'SCHEMA', @level0name = N'dbo',
        @level1type = N'TABLE', @level1name = N'AlertHistory';
END
GO

-- ============================================================================
-- Insert default alert rules
-- ============================================================================
PRINT '';
PRINT 'Creating default alert rules...';

-- Queue Depth Alert
IF NOT EXISTS (SELECT * FROM dbo.AlertRules WHERE RuleName = 'Default Queue Depth Alert')
BEGIN
    INSERT INTO dbo.AlertRules (RuleName, RuleType, QueueName, WarningThreshold, CriticalThreshold, NotificationChannels)
    VALUES (
        'Default Queue Depth Alert',
        'QUEUE_DEPTH',
        NULL,  -- Applies to all queues
        1000,  -- Warning at 1000 messages
        5000,  -- Critical at 5000 messages
        '["email"]'
    );
    PRINT '  Created: Default Queue Depth Alert';
END

-- Message Age Alert
IF NOT EXISTS (SELECT * FROM dbo.AlertRules WHERE RuleName = 'Default Message Age Alert')
BEGIN
    INSERT INTO dbo.AlertRules (RuleName, RuleType, QueueName, WarningThreshold, CriticalThreshold, NotificationChannels)
    VALUES (
        'Default Message Age Alert',
        'MESSAGE_AGE',
        NULL,  -- Applies to all queues
        300,   -- Warning at 5 minutes (300 seconds)
        900,   -- Critical at 15 minutes (900 seconds)
        '["email"]'
    );
    PRINT '  Created: Default Message Age Alert';
END

-- Poison Message Alert
IF NOT EXISTS (SELECT * FROM dbo.AlertRules WHERE RuleName = 'Poison Message Detection')
BEGIN
    INSERT INTO dbo.AlertRules (RuleName, RuleType, QueueName, WarningThreshold, CriticalThreshold, NotificationChannels)
    VALUES (
        'Poison Message Detection',
        'POISON_MESSAGE',
        NULL,  -- Applies to all queues
        1,     -- Warning at 1 poison message
        5,     -- Critical at 5 poison messages
        '["email"]'
    );
    PRINT '  Created: Poison Message Detection';
END

-- Disabled Queue Alert
IF NOT EXISTS (SELECT * FROM dbo.AlertRules WHERE RuleName = 'Disabled Queue Detection')
BEGIN
    INSERT INTO dbo.AlertRules (RuleName, RuleType, QueueName, WarningThreshold, CriticalThreshold, NotificationChannels)
    VALUES (
        'Disabled Queue Detection',
        'DISABLED_QUEUE',
        NULL,  -- Applies to all queues
        1,     -- Any disabled queue triggers warning
        1,     -- Same for critical
        '["email"]'
    );
    PRINT '  Created: Disabled Queue Detection';
END

-- Transmission Queue Alert
IF NOT EXISTS (SELECT * FROM dbo.AlertRules WHERE RuleName = 'Transmission Queue Backup')
BEGIN
    INSERT INTO dbo.AlertRules (RuleName, RuleType, QueueName, WarningThreshold, CriticalThreshold, NotificationChannels)
    VALUES (
        'Transmission Queue Backup',
        'TRANSMISSION_QUEUE',
        NULL,
        100,   -- Warning at 100 messages
        500,   -- Critical at 500 messages
        '["email"]'
    );
    PRINT '  Created: Transmission Queue Backup';
END
GO

-- ============================================================================
-- Procedure to clean up old alert history
-- ============================================================================
IF EXISTS (SELECT * FROM sys.procedures WHERE name = N'usp_CleanupAlertHistory')
BEGIN
    DROP PROCEDURE [dbo].[usp_CleanupAlertHistory];
END
GO

CREATE PROCEDURE [dbo].[usp_CleanupAlertHistory]
    @RetentionDays INT = 90,  -- Default: keep 90 days of alert history
    @BatchSize INT = 5000
AS
BEGIN
    SET NOCOUNT ON;

    DECLARE @CutoffDate DATETIME2 = DATEADD(DAY, -@RetentionDays, SYSDATETIME());
    DECLARE @RowsDeleted INT = 1;
    DECLARE @TotalDeleted INT = 0;

    PRINT 'Cleaning up AlertHistory records older than ' + CAST(@RetentionDays AS NVARCHAR(10)) + ' days...';

    WHILE @RowsDeleted > 0
    BEGIN
        DELETE TOP (@BatchSize)
        FROM dbo.AlertHistory
        WHERE TriggeredAt < @CutoffDate
          AND ResolvedAt IS NOT NULL;  -- Only delete resolved alerts

        SET @RowsDeleted = @@ROWCOUNT;
        SET @TotalDeleted = @TotalDeleted + @RowsDeleted;

        IF @RowsDeleted > 0
            WAITFOR DELAY '00:00:00.100';
    END

    PRINT 'Cleanup complete. Total records deleted: ' + CAST(@TotalDeleted AS NVARCHAR(10));
END
GO

PRINT 'Created procedure: usp_CleanupAlertHistory';

-- ============================================================================
-- Verification
-- ============================================================================
PRINT '';
PRINT '========================================';
PRINT 'Verification - Alert Tables';
PRINT '========================================';
PRINT '';

PRINT 'AlertRules Table:';
PRINT '-----------------';

SELECT
    c.name AS [Column Name],
    t.name AS [Data Type],
    CASE c.is_nullable WHEN 1 THEN 'Yes' ELSE 'No' END AS [Nullable]
FROM sys.columns c
INNER JOIN sys.types t ON c.user_type_id = t.user_type_id
WHERE c.object_id = OBJECT_ID('dbo.AlertRules')
ORDER BY c.column_id;

PRINT '';
PRINT 'AlertHistory Table:';
PRINT '-------------------';

SELECT
    c.name AS [Column Name],
    t.name AS [Data Type],
    CASE c.is_nullable WHEN 1 THEN 'Yes' ELSE 'No' END AS [Nullable]
FROM sys.columns c
INNER JOIN sys.types t ON c.user_type_id = t.user_type_id
WHERE c.object_id = OBJECT_ID('dbo.AlertHistory')
ORDER BY c.column_id;

PRINT '';
PRINT 'Default Alert Rules Created:';
PRINT '----------------------------';

SELECT
    Id,
    RuleName,
    RuleType,
    ISNULL(QueueName, '(All Queues)') AS QueueName,
    WarningThreshold,
    CriticalThreshold,
    CASE IsEnabled WHEN 1 THEN 'Yes' ELSE 'No' END AS IsEnabled
FROM dbo.AlertRules
ORDER BY Id;

PRINT '';
PRINT '========================================';
PRINT 'Script completed successfully.';
PRINT '========================================';
GO
