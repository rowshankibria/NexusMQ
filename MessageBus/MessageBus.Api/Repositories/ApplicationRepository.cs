using MessageBus.Api.Data;
using MessageBus.Api.Models;
using MessageBus.Api.Repositories.Interfaces;
using Microsoft.EntityFrameworkCore;

namespace MessageBus.Api.Repositories;

/// <summary>
/// Repository implementation for application registration operations
/// </summary>
public class ApplicationRepository : IApplicationRepository
{
    private readonly MessageBusDbContext _context;

    public ApplicationRepository(MessageBusDbContext context)
    {
        _context = context;
    }

    public async Task<List<Application>> GetAllAsync()
    {
        return await _context.Applications
            .OrderByDescending(a => a.CreatedAt)
            .ToListAsync();
    }

    public async Task<Application?> GetByIdAsync(int id)
    {
        return await _context.Applications
            .FirstOrDefaultAsync(a => a.Id == id);
    }

    public async Task<Application?> GetByApiKeyAsync(string apiKey)
    {
        return await _context.Applications
            .FirstOrDefaultAsync(a => a.ApiKey == apiKey);
    }

    public async Task<Application?> GetByNameAsync(string name)
    {
        return await _context.Applications
            .FirstOrDefaultAsync(a => a.Name == name);
    }

    public async Task<Application> CreateAsync(Application application)
    {
        _context.Applications.Add(application);
        await _context.SaveChangesAsync();
        return application;
    }

    public async Task<Application> UpdateAsync(Application application)
    {
        _context.Applications.Update(application);
        await _context.SaveChangesAsync();
        return application;
    }

    public async Task DeleteAsync(int id)
    {
        var application = await GetByIdAsync(id);
        if (application != null)
        {
            _context.Applications.Remove(application);
            await _context.SaveChangesAsync();
        }
    }

    public async Task UpdateLastUsedAsync(int id)
    {
        var application = await GetByIdAsync(id);
        if (application != null)
        {
            application.LastUsedAt = DateTime.UtcNow;
            await _context.SaveChangesAsync();
        }
    }

    public async Task<bool> ApiKeyExistsAsync(string apiKey)
    {
        return await _context.Applications
            .AnyAsync(a => a.ApiKey == apiKey);
    }
}
