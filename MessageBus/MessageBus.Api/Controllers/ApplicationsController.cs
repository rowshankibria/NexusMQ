using MessageBus.Api.Models;
using MessageBus.Api.Services.Interfaces;
using Microsoft.AspNetCore.Mvc;

namespace MessageBus.Api.Controllers;

/// <summary>
/// API endpoints for application registration and API key management
/// </summary>
[ApiController]
[Route("api/[controller]")]
[Produces("application/json")]
public class ApplicationsController : ControllerBase
{
    private readonly IApplicationService _applicationService;
    private readonly ILogger<ApplicationsController> _logger;

    public ApplicationsController(
        IApplicationService applicationService,
        ILogger<ApplicationsController> logger)
    {
        _applicationService = applicationService;
        _logger = logger;
    }

    /// <summary>
    /// List all registered applications
    /// </summary>
    /// <returns>List of applications with masked API keys</returns>
    [HttpGet]
    [ProducesResponseType(typeof(List<ApplicationResponse>), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status500InternalServerError)]
    public async Task<ActionResult<List<ApplicationResponse>>> GetApplications()
    {
        try
        {
            var applications = await _applicationService.GetAllApplicationsAsync();
            return Ok(applications);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to get applications");
            return StatusCode(500, new { error = "Failed to retrieve applications", message = ex.Message });
        }
    }

    /// <summary>
    /// Get a specific application by ID
    /// </summary>
    /// <param name="id">Application ID</param>
    /// <returns>Application details with masked API key</returns>
    [HttpGet("{id}")]
    [ProducesResponseType(typeof(ApplicationResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status500InternalServerError)]
    public async Task<ActionResult<ApplicationResponse>> GetApplication(int id)
    {
        try
        {
            var application = await _applicationService.GetApplicationByIdAsync(id);
            if (application == null)
            {
                return NotFound(new { error = "Application not found", id });
            }
            return Ok(application);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to get application {Id}", id);
            return StatusCode(500, new { error = "Failed to retrieve application", message = ex.Message });
        }
    }

    /// <summary>
    /// Register a new application
    /// </summary>
    /// <param name="request">Application registration details</param>
    /// <returns>Registered application with API key (shown once only)</returns>
    [HttpPost]
    [ProducesResponseType(typeof(RegisterApplicationResponse), StatusCodes.Status201Created)]
    [ProducesResponseType(typeof(ServiceResult), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status500InternalServerError)]
    public async Task<ActionResult<RegisterApplicationResponse>> RegisterApplication(
        [FromBody] RegisterApplicationRequest request)
    {
        try
        {
            _logger.LogInformation("Registering new application: {Name}", request.Name);
            var result = await _applicationService.RegisterApplicationAsync(request);

            if (!result.Success)
            {
                return BadRequest(result);
            }

            return CreatedAtAction(
                nameof(GetApplication),
                new { id = result.Result!.Id },
                result.Result);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to register application {Name}", request.Name);
            return StatusCode(500, new { error = "Failed to register application", message = ex.Message });
        }
    }

    /// <summary>
    /// Update an existing application
    /// </summary>
    /// <param name="id">Application ID</param>
    /// <param name="request">Update details</param>
    /// <returns>Updated application</returns>
    [HttpPut("{id}")]
    [ProducesResponseType(typeof(ApplicationResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ServiceResult), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status500InternalServerError)]
    public async Task<ActionResult<ApplicationResponse>> UpdateApplication(
        int id,
        [FromBody] UpdateApplicationRequest request)
    {
        try
        {
            _logger.LogInformation("Updating application {Id}", id);
            var result = await _applicationService.UpdateApplicationAsync(id, request);

            if (!result.Success)
            {
                if (result.Message.Contains("not found"))
                {
                    return NotFound(result);
                }
                return BadRequest(result);
            }

            return Ok(result.Result);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to update application {Id}", id);
            return StatusCode(500, new { error = "Failed to update application", message = ex.Message });
        }
    }

    /// <summary>
    /// Delete an application
    /// </summary>
    /// <param name="id">Application ID</param>
    /// <returns>Success result</returns>
    [HttpDelete("{id}")]
    [ProducesResponseType(typeof(ServiceResult), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ServiceResult), StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status500InternalServerError)]
    public async Task<ActionResult<ServiceResult>> DeleteApplication(int id)
    {
        try
        {
            _logger.LogWarning("Deleting application {Id}", id);
            var result = await _applicationService.DeleteApplicationAsync(id);

            if (!result.Success)
            {
                if (result.Message.Contains("not found"))
                {
                    return NotFound(result);
                }
                return BadRequest(result);
            }

            return Ok(result);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to delete application {Id}", id);
            return StatusCode(500, new { error = "Failed to delete application", message = ex.Message });
        }
    }

    /// <summary>
    /// Regenerate API key for an application
    /// </summary>
    /// <param name="id">Application ID</param>
    /// <returns>New API key (shown once only)</returns>
    [HttpPost("{id}/regenerate-key")]
    [ProducesResponseType(typeof(RegenerateKeyResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ServiceResult), StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status500InternalServerError)]
    public async Task<ActionResult<RegenerateKeyResponse>> RegenerateApiKey(int id)
    {
        try
        {
            _logger.LogWarning("Regenerating API key for application {Id}", id);
            var result = await _applicationService.RegenerateApiKeyAsync(id);

            if (!result.Success)
            {
                if (result.Message.Contains("not found"))
                {
                    return NotFound(result);
                }
                return BadRequest(result);
            }

            return Ok(result.Result);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to regenerate API key for application {Id}", id);
            return StatusCode(500, new { error = "Failed to regenerate API key", message = ex.Message });
        }
    }
}
