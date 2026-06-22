/*
    99-VerifyAllObjects.sql
    Service Broker Message Bus - Object Verification Script

    Purpose: Verification script to confirm all Service Broker objects
             and custom tables/procedures/views exist
*/

SET NOCOUNT ON;

PRINT '============================================';
PRINT 'Service Broker Message Bus - Object Verification';
PRINT '============================================';
PRINT '';

-- Check message types
PRINT 'MESSAGE TYPES:';
PRINT '-------------';
SELECT 'Message Type' AS ObjectType, name FROM sys.service_message_types WHERE is_ms_shipped = 0;
PRINT '';

-- Check contracts
PRINT 'CONTRACTS:';
PRINT '----------';
SELECT 'Contract' AS ObjectType, name FROM sys.service_contracts WHERE is_ms_shipped = 0;
PRINT '';

-- Check queues
PRINT 'QUEUES:';
PRINT '-------';
SELECT 'Queue' AS ObjectType, name, is_receive_enabled, is_activation_enabled FROM sys.service_queues WHERE is_ms_shipped = 0;
PRINT '';

-- Check services
PRINT 'SERVICES:';
PRINT '---------';
SELECT 'Service' AS ObjectType, name FROM sys.services WHERE is_ms_shipped = 0;
PRINT '';

-- Check custom tables
PRINT 'CUSTOM TABLES:';
PRINT '--------------';
SELECT 'Table' AS ObjectType, name FROM sys.tables WHERE name IN ('DeadLetterQueue', 'MessageAuditTrail', 'PerformanceMetrics', 'RegisteredApplications', 'AlertRules', 'AlertHistory');
PRINT '';

-- Check stored procedures
PRINT 'STORED PROCEDURES:';
PRINT '------------------';
SELECT 'Procedure' AS ObjectType, name FROM sys.procedures WHERE name LIKE 'usp_%';
PRINT '';

-- Check views
PRINT 'VIEWS:';
PRINT '------';
SELECT 'View' AS ObjectType, name FROM sys.views WHERE name LIKE 'vw_%';
PRINT '';

PRINT '============================================';
PRINT 'Verification complete.';
PRINT '============================================';
GO
