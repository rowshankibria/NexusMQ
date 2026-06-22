/*
    43-vw_PoisonMessages.sql
    Service Broker Message Bus - Poison Messages View

    Purpose: Shows messages in the dead letter queue that may be causing
             queue poisoning issues

    Note: True poison detection requires monitoring queue disable events.
          This view shows unresolved dead letter messages as potential poison candidates.
*/

IF OBJECT_ID('dbo.vw_PoisonMessages', 'V') IS NOT NULL
    DROP VIEW dbo.vw_PoisonMessages;
GO

CREATE VIEW dbo.vw_PoisonMessages AS
SELECT
    dlq.Id,
    dlq.ConversationHandle,
    dlq.SourceQueueName,
    dlq.MessageTypeName,
    dlq.ErrorMessage,
    dlq.RetryCount,
    dlq.MaxRetries,
    dlq.MovedToDeadLetterAt,
    dlq.LastRetryAt,
    CASE WHEN dlq.ResolvedAt IS NOT NULL THEN 'Resolved' ELSE 'Pending' END AS Status
FROM dbo.DeadLetterQueue dlq
WHERE dlq.ResolvedAt IS NULL;
GO

PRINT 'Created view: dbo.vw_PoisonMessages';
GO
