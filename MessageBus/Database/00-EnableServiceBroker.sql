/*
================================================================================
Script: 00-EnableServiceBroker.sql
Purpose: Enable SQL Server Service Broker on the target database
Phase: 0 - SQL Server Service Broker Foundation
================================================================================
IMPORTANT: Run this script in the context of the target database
================================================================================
*/

USE [MessageBus]; -- Change to your target database name
GO

SET NOCOUNT ON;

PRINT '========================================';
PRINT 'Service Broker Configuration Script';
PRINT '========================================';
PRINT '';

-- Step 1: Check current Service Broker status
DECLARE @DatabaseName NVARCHAR(128) = DB_NAME();
DECLARE @IsBrokerEnabled BIT;

SELECT @IsBrokerEnabled = is_broker_enabled
FROM sys.databases
WHERE name = @DatabaseName;

PRINT 'Database: ' + @DatabaseName;
PRINT 'Current Service Broker Status: ' + CASE WHEN @IsBrokerEnabled = 1 THEN 'ENABLED' ELSE 'DISABLED' END;
PRINT '';

-- Step 2: Enable Service Broker if not already enabled
IF @IsBrokerEnabled = 0
BEGIN
    PRINT 'Attempting to enable Service Broker...';
    PRINT 'Note: This will rollback any active transactions and disconnect users.';
    PRINT '';

    BEGIN TRY
        -- Use dynamic SQL because ALTER DATABASE cannot use variables directly
        DECLARE @SQL NVARCHAR(MAX);

        -- First, try to enable without forcing disconnections
        SET @SQL = N'ALTER DATABASE [' + @DatabaseName + N'] SET ENABLE_BROKER';

        BEGIN TRY
            EXEC sp_executesql @SQL;
            PRINT 'Service Broker enabled successfully (no active connections).';
        END TRY
        BEGIN CATCH
            -- If that fails, force disconnect active connections
            PRINT 'Active connections detected. Forcing rollback of active transactions...';
            SET @SQL = N'ALTER DATABASE [' + @DatabaseName + N'] SET ENABLE_BROKER WITH ROLLBACK IMMEDIATE';
            EXEC sp_executesql @SQL;
            PRINT 'Service Broker enabled successfully (connections rolled back).';
        END CATCH

    END TRY
    BEGIN CATCH
        PRINT 'ERROR enabling Service Broker:';
        PRINT 'Error Number: ' + CAST(ERROR_NUMBER() AS NVARCHAR(10));
        PRINT 'Error Message: ' + ERROR_MESSAGE();
        PRINT '';
        PRINT 'Possible solutions:';
        PRINT '1. Run this script as a sysadmin';
        PRINT '2. Ensure database is not part of a mirroring session';
        PRINT '3. Ensure database is not a snapshot';
        PRINT '4. Check if database is in an availability group';
        RETURN;
    END CATCH
END
ELSE
BEGIN
    PRINT 'Service Broker is already enabled. No action needed.';
END

PRINT '';

-- Step 3: Verify Service Broker is now enabled
SELECT @IsBrokerEnabled = is_broker_enabled
FROM sys.databases
WHERE name = @DatabaseName;

PRINT '========================================';
PRINT 'Verification';
PRINT '========================================';
PRINT 'Service Broker Status: ' + CASE WHEN @IsBrokerEnabled = 1 THEN 'ENABLED' ELSE 'DISABLED' END;

IF @IsBrokerEnabled = 1
BEGIN
    PRINT '';
    PRINT 'Service Broker GUID: ' + CAST((SELECT service_broker_guid FROM sys.databases WHERE name = @DatabaseName) AS NVARCHAR(50));
    PRINT '';
    PRINT 'SUCCESS: Service Broker is ready for use.';
END
ELSE
BEGIN
    PRINT '';
    PRINT 'FAILED: Service Broker could not be enabled.';
    PRINT 'Please check the error messages above and try again.';
END

PRINT '';
PRINT '========================================';
PRINT 'Script completed.';
PRINT '========================================';
GO
