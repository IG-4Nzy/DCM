using DCM.Core.Models;
using Microsoft.EntityFrameworkCore;

namespace DCM.Infrastructure.Data;

public class DcmDbContext : DbContext
{
    public DcmDbContext(DbContextOptions<DcmDbContext> options) : base(options)
    {
    }

    public DbSet<User> Users { get; set; }
    public DbSet<Role> Roles { get; set; }

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);

        modelBuilder.Entity<Role>().HasData(
            new Role { Id = 1, Name = "Admin" },
            new Role { Id = 2, Name = "Staff" }
        );
    }
}
