/*
================================================================================
Script: 13-CreateRegisteredApplications.sql
Purpose: Create the RegisteredApplications table for API client management
Phase: 0.5A - SQL Server Custom Tables
================================================================================
Prerequisites: Phase 0 scripts (00-07) must be run first
================================================================================
The RegisteredApplications table manages external applications that can
interact with the Message Bus via the API. It supports API key authentication
and queue-level permissions.
================================================================================
*/

USE [MessageBus]; -- Change to your target database name
GO

SET NOCOUNT ON;

PRINT '========================================';
PRINT 'Creating RegisteredApplications Table';
PRINT '========================================';
PRINT '';

-- ============================================================================
-- Table: RegisteredApplications
-- Purpose: Manage API clients and their permissions
-- ============================================================================
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = N'RegisteredApplications' AND schema_id = SCHEMA_ID('dbo'))
BEGIN
    CREATE TABLE dbo.RegisteredApplications (
        -- Primary key
        Id INT IDENTITY(1,1) PRIMARY KEY,

        -- Application identification
        ApplicationName NVARCHAR(256) NOT NULL,
        Description NVARCHAR(500) NULL,

        -- API key (stored as plaintext for lookup, hash for verification)
        ApiKey NVARCHAR(256) NOT NULL,
        ApiKeyHash VARBINARY(256) NULL, -- SHA-256 hash for secure verification

        -- Status
        IsActive BIT NOT NULL DEFAULT 1,

        -- Permissions
        AllowedQueuesJson NVARCHAR(MAX) NULL, -- JSON array: ["Queue1", "Queue2"] or null for all
        CanPublish BIT NOT NULL DEFAULT 1,
        CanSubscribe BIT NOT NULL DEFAULT 1,

        -- Audit fields
        CreatedAt DATETIME2 NOT NULL DEFAULT SYSDATETIME(),
        CreatedBy NVARCHAR(256) NULL DEFAULT SUSER_SNAME(),
        LastUsedAt DATETIME2 NULL,
        LastModifiedAt DATETIME2 NULL,
        LastModifiedBy NVARCHAR(256) NULL,

        -- Constraints
        CONSTRAINT UQ_RegisteredApplications_Name UNIQUE (ApplicationName),
        CONSTRAINT UQ_RegisteredApplications_ApiKey UNIQUE (ApiKey),

        -- Indexes
        INDEX IX_Apps_ApiKey NONCLUSTERED (ApiKey),
        INDEX IX_Apps_Name NONCLUSTERED (ApplicationName),
        INDEX IX_Apps_Active NONCLUSTERED (IsActive) WHERE IsActive = 1
    );

    PRINT 'Created table: dbo.RegisteredApplications';
END
ELSE
BEGIN
    PRINT 'Table already exists: dbo.RegisteredApplications';
END
GO

-- ============================================================================
-- Add extended properties for documentation
-- ============================================================================
IF NOT EXISTS (SELECT * FROM sys.extended_properties WHERE major_id = OBJECT_ID('dbo.RegisteredApplications') AND name = 'MS_Description')
BEGIN
    EXEC sp_addextendedproperty
        @name = N'MS_Description',
        @value = N'Stores registered API client applications with their API keys and queue access permissions.',
        @level0type = N'SCHEMA', @level0name = N'dbo',
        @level1type = N'TABLE', @level1name = N'RegisteredApplications';

    PRINT 'Added table description.';
END
GO

-- ============================================================================
-- Helper procedure to generate API keys
-- ============================================================================
IF EXISTS (SELECT * FROM sys.procedures WHERE name = N'usp_GenerateApiKey')
BEGIN
    DROP PROCEDURE [dbo].[usp_GenerateApiKey];
END
GO

CREATE PROCEDURE [dbo].[usp_GenerateApiKey]
    @ApiKey NVARCHAR(256) OUTPUT
AS
BEGIN
    SET NOCOUNT ON;

    -- Generate a secure random API key using NEWID and CRYPT_GEN_RANDOM
    -- Format: mb_XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX (prefix + 32 hex chars)
    DECLARE @RandomBytes VARBINARY(16) = CRYPT_GEN_RANDOM(16);

    SET @ApiKey = 'mb_' +
        LOWER(CONVERT(NVARCHAR(32),
            CONVERT(VARBINARY(16), @RandomBytes), 2
        ));
END
GO

PRINT 'Created procedure: usp_GenerateApiKey';

-- ============================================================================
-- Procedure to register a new application
-- ============================================================================
IF EXISTS (SELECT * FROM sys.procedures WHERE name = N'usp_RegisterApplication')
BEGIN
    DROP PROCEDURE [dbo].[usp_RegisterApplication];
END
GO

CREATE PROCEDURE [dbo].[usp_RegisterApplication]
    @ApplicationName NVARCHAR(256),
    @Description NVARCHAR(500) = NULL,
    @AllowedQueues NVARCHAR(MAX) = NULL,  -- JSON array or NULL for all queues
    @CanPublish BIT = 1,
    @CanSubscribe BIT = 1,
    @ApiKey NVARCHAR(256) OUTPUT
AS
BEGIN
    SET NOCOUNT ON;

    BEGIN TRY
        -- Generate new API key
        EXEC dbo.usp_GenerateApiKey @ApiKey = @ApiKey OUTPUT;

        -- Calculate API key hash for secure verification
        DECLARE @ApiKeyHash VARBINARY(256) = HASHBYTES('SHA2_256', @ApiKey);

        -- Insert the new application
        INSERT INTO dbo.RegisteredApplications (
            ApplicationName,
            Description,
            ApiKey,
            ApiKeyHash,
            AllowedQueuesJson,
            CanPublish,
            CanSubscribe
        )
        VALUES (
            @ApplicationName,
            @Description,
            @ApiKey,
            @ApiKeyHash,
            @AllowedQueues,
            @CanPublish,
            @CanSubscribe
        );

        -- Return the new application details
        SELECT
            Id,
            ApplicationName,
            ApiKey,
            IsActive,
            CanPublish,
            CanSubscribe,
            AllowedQueuesJson,
            CreatedAt
        FROM dbo.RegisteredApplications
        WHERE ApplicationName = @ApplicationName;

        PRINT 'Application registered successfully: ' + @ApplicationName;

    END TRY
    BEGIN CATCH
        DECLARE @ErrorMessage NVARCHAR(4000) = ERROR_MESSAGE();

        IF ERROR_NUMBER() = 2627 -- Unique constraint violation
        BEGIN
            RAISERROR('Application name or API key already exists.', 16, 1);
        END
        ELSE
        BEGIN
            RAISERROR(@ErrorMessage, 16, 1);
        END
    END CATCH
END
GO

PRINT 'Created procedure: usp_RegisterApplication';

-- ============================================================================
-- Procedure to validate an API key
-- ============================================================================
IF EXISTS (SELECT * FROM sys.procedures WHERE name = N'usp_ValidateApiKey')
BEGIN
    DROP PROCEDURE [dbo].[usp_ValidateApiKey];
END
GO

CREATE PROCEDURE [dbo].[usp_ValidateApiKey]
    @ApiKey NVARCHAR(256),
    @QueueName NVARCHAR(256) = NULL,  -- Optional: validate access to specific queue
    @RequirePublish BIT = 0,
    @RequireSubscribe BIT = 0,
    @IsValid BIT OUTPUT,
    @ApplicationName NVARCHAR(256) OUTPUT
AS
BEGIN
    SET NOCOUNT ON;

    SET @IsValid = 0;
    SET @ApplicationName = NULL;

    DECLARE @AllowedQueuesJson NVARCHAR(MAX);
    DECLARE @CanPublish BIT;
    DECLARE @CanSubscribe BIT;
    DECLARE @AppId INT;

    -- Look up the application
    SELECT
        @AppId = Id,
        @ApplicationName = ApplicationName,
        @AllowedQueuesJson = AllowedQueuesJson,
        @CanPublish = CanPublish,
        @CanSubscribe = CanSubscribe
    FROM dbo.RegisteredApplications
    WHERE ApiKey = @ApiKey
      AND IsActive = 1;

    IF @AppId IS NULL
    BEGIN
        -- Invalid or inactive API key
        RETURN;
    END

    -- Check publish permission if required
    IF @RequirePublish = 1 AND @CanPublish = 0
    BEGIN
        RETURN;
    END

    -- Check subscribe permission if required
    IF @RequireSubscribe = 1 AND @CanSubscribe = 0
    BEGIN
        RETURN;
    END

    -- Check queue access if specified
    IF @QueueName IS NOT NULL AND @AllowedQueuesJson IS NOT NULL
    BEGIN
        -- Check if the queue is in the allowed list
        IF NOT EXISTS (
            SELECT 1
            FROM OPENJSON(@AllowedQueuesJson)
            WHERE value = @QueueName
        )
        BEGIN
            RETURN;
        END
    END

    -- All checks passed
    SET @IsValid = 1;

    -- Update last used timestamp
    UPDATE dbo.RegisteredApplications
    SET LastUsedAt = SYSDATETIME()
    WHERE Id = @AppId;
END
GO

PRINT 'Created procedure: usp_ValidateApiKey';

-- ============================================================================
-- Verification
-- ============================================================================
PRINT '';
PRINT '========================================';
PRINT 'Verification - RegisteredApplications';
PRINT '========================================';
PRINT '';

SELECT
    c.name AS [Column Name],
    t.name AS [Data Type],
    CASE
        WHEN t.name IN ('nvarchar', 'varchar') THEN
            CASE WHEN c.max_length = -1 THEN 'MAX' ELSE CAST(c.max_length / 2 AS VARCHAR(10)) END
        WHEN t.name IN ('varbinary') THEN
            CASE WHEN c.max_length = -1 THEN 'MAX' ELSE CAST(c.max_length AS VARCHAR(10)) END
        ELSE ''
    END AS [Length],
    CASE c.is_nullable WHEN 1 THEN 'Yes' ELSE 'No' END AS [Nullable],
    CASE c.is_identity WHEN 1 THEN 'Yes' ELSE '' END AS [Identity],
    ISNULL(dc.definition, '') AS [Default]
FROM sys.columns c
INNER JOIN sys.types t ON c.user_type_id = t.user_type_id
LEFT JOIN sys.default_constraints dc ON c.default_object_id = dc.object_id
WHERE c.object_id = OBJECT_ID('dbo.RegisteredApplications')
ORDER BY c.column_id;

PRINT '';
PRINT 'Related Procedures:';
PRINT '-------------------';

SELECT name AS [Procedure Name]
FROM sys.procedures
WHERE name IN ('usp_GenerateApiKey', 'usp_RegisterApplication', 'usp_ValidateApiKey')
ORDER BY name;

PRINT '';
PRINT '========================================';
PRINT 'Usage Example';
PRINT '========================================';
PRINT '';
PRINT '-- Register a new application:';
PRINT 'DECLARE @NewApiKey NVARCHAR(256);';
PRINT 'EXEC dbo.usp_RegisterApplication';
PRINT '    @ApplicationName = ''MyApp'',';
PRINT '    @Description = ''My application'',';
PRINT '    @AllowedQueues = ''["MessageBusTargetQueue"]'',';
PRINT '    @CanPublish = 1,';
PRINT '    @CanSubscribe = 1,';
PRINT '    @ApiKey = @NewApiKey OUTPUT;';
PRINT '';
PRINT 'SELECT @NewApiKey AS GeneratedApiKey;';
PRINT '';
PRINT '========================================';
PRINT 'Script completed successfully.';
PRINT '========================================';
GO
