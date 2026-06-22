namespace MessageBus.Client.Models;

/// <summary>
/// Exception thrown by MessageBus client operations
/// </summary>
public class MessageBusException : Exception
{
    /// <summary>
    /// HTTP status code if applicable
    /// </summary>
    public int? StatusCode { get; }

    /// <summary>
    /// Error code from the API
    /// </summary>
    public string? ErrorCode { get; }

    public MessageBusException(string message) : base(message)
    {
    }

    public MessageBusException(string message, Exception innerException) : base(message, innerException)
    {
    }

    public MessageBusException(string message, int statusCode) : base(message)
    {
        StatusCode = statusCode;
    }

    public MessageBusException(string message, int statusCode, string errorCode) : base(message)
    {
        StatusCode = statusCode;
        ErrorCode = errorCode;
    }
}

/// <summary>
/// Exception thrown when authentication fails
/// </summary>
public class MessageBusAuthenticationException : MessageBusException
{
    public MessageBusAuthenticationException(string message) : base(message, 401)
    {
    }
}

/// <summary>
/// Exception thrown when authorization fails
/// </summary>
public class MessageBusAuthorizationException : MessageBusException
{
    public MessageBusAuthorizationException(string message) : base(message, 403)
    {
    }
}

/// <summary>
/// Exception thrown when a resource is not found
/// </summary>
public class MessageBusNotFoundException : MessageBusException
{
    public MessageBusNotFoundException(string message) : base(message, 404)
    {
    }
}
