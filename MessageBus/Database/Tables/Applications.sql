-- =============================================
-- Applications Table for API Key Management
-- Phase 12: External Integration
-- =============================================

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'Applications' AND schema_id = SCHEMA_ID('dbo'))
BEGIN
    CREATE TABLE dbo.Applications
    (
        Id              INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
        Name            NVARCHAR(100) NOT NULL,
        ApiKey          NVARCHAR(64) NOT NULL UNIQUE,
        Description     NVARCHAR(500) NULL,
        IsActive        BIT NOT NULL DEFAULT 1,
        CreatedAt       DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
        ExpiresAt       DATETIME2 NULL,
        Permissions     NVARCHAR(MAX) NOT NULL DEFAULT '["read"]', -- JSON array
        AllowedQueues   NVARCHAR(MAX) NOT NULL DEFAULT '["*"]',    -- JSON array
        ContactEmail    NVARCHAR(255) NULL,
        LastUsedAt      DATETIME2 NULL,

        CONSTRAINT CK_Applications_Permissions CHECK (ISJSON(Permissions) = 1),
        CONSTRAINT CK_Applications_AllowedQueues CHECK (ISJSON(AllowedQueues) = 1)
    );

    -- Index for API key lookups (used by authentication)
    CREATE NONCLUSTERED INDEX IX_Applications_ApiKey
        ON dbo.Applications (ApiKey)
        WHERE IsActive = 1;

    -- Index for name lookups
    CREATE NONCLUSTERED INDEX IX_Applications_Name
        ON dbo.Applications (Name);

    PRINT 'Created dbo.Applications table';
END
ELSE
BEGIN
    PRINT 'dbo.Applications table already exists';
END
GO

-- Insert default development application (optional - comment out in production)
IF NOT EXISTS (SELECT 1 FROM dbo.Applications WHERE Name = 'Development')
BEGIN
    INSERT INTO dbo.Applications (Name, ApiKey, Description, Permissions, AllowedQueues, ContactEmail)
    VALUES (
        'Development',
        'mb-dev-key-change-in-production',
        'Default development API key. Replace in production.',
        '["*"]',
        '["*"]',
        'dev@conedison.com'
    );
    PRINT 'Inserted default development application';
END
GO
