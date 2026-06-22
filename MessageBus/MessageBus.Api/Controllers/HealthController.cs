using MessageBus.Api.Services.Interfaces;
using Microsoft.AspNetCore.Mvc;

namespace MessageBus.Api.Controllers;

/// <summary>
/// Health check API endpoints
/// </summary>
[ApiController]
[Route("api/[controller]")]
public class HealthController : ControllerBase
{
    private readonly IHealthService _healthService;
    private readonly ILogger<HealthController> _logger;

    public HealthController(IHealthService healthService, ILogger<HealthController> logger)
    {
        _healthService = healthService;
        _logger = logger;
    }

    /// <summary>
    /// Run comprehensive health check on Service Broker infrastructure
    /// </summary>
    /// <returns>Health check result with broker status, queue health, and overall summary</returns>
    [HttpGet]
    [ProducesResponseType(typeof(HealthCheckResult), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status500InternalServerError)]
    public async Task<ActionResult<HealthCheckResult>> GetHealthCheck()
    {
        try
        {
            var result = await _healthService.RunHealthCheckAsync();
            return Ok(result);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Health check failed");
            return StatusCode(500, new { error = "Health check failed", message = ex.Message });
        }
    }

    /// <summary>
    /// Simple ping endpoint to verify API is running
    /// </summary>
    [HttpGet("ping")]
    [ProducesResponseType(typeof(object), StatusCodes.Status200OK)]
    public ActionResult Ping()
    {
        return Ok(new
        {
            status = "ok",
            timestamp = DateTime.UtcNow,
            service = "MessageBus.Api"
        });
    }
}
