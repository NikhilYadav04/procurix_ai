import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// Helper: Validate email format
function validateEmail(email: string): boolean {
  const pattern = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
  return pattern.test(email);
}

// Helper: Parse vendors from text/document content
function parseVendorsFromText(text: string): Array<{ name: string; email: string }> {
  const vendors: Array<{ name: string; email: string }> = [];
  const lines = text.split('\n');
  
  // Try to find patterns like "Name: abc, Email: xyz" or "abc - xyz@email.com"
  const patterns = [
    /([^,\n]+)[,\s]*[-:]\s*([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/gi,
    /([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})\s*[-:,]\s*([^,\n]+)/gi,
  ];

  for (const line of lines) {
    for (const pattern of patterns) {
      const matches = [...line.matchAll(pattern)];
      for (const match of matches) {
        const name = match[1]?.trim();
        const email = match[2]?.trim();
        
        if (name && email && validateEmail(email)) {
          vendors.push({ name, email });
        }
      }
    }
  }

  return vendors;
}

// TOOL 1: Add Vendor
export const addVendorTool = tool(
  async ({ name, email, website, address, phone, gstin, is_msme, udyam_number, customer_email }, config) => {
    try {
      // Get customer email from config if not provided
      const actualCustomerEmail = customer_email || config?.configurable?.customerEmail;
      
      if (!actualCustomerEmail) {
        return JSON.stringify({
          success: false,
          error: 'Customer email is required to add vendors. Please ensure you are logged in.',
        });
      }

      // Validate email
      if (!validateEmail(email)) {
        return JSON.stringify({
          success: false,
          error: `Invalid email format: ${email}`,
        });
      }

      // Check if vendor already exists for this customer
      const { data: existingVendor } = await supabase
        .from("vendors")
        .select("id, name, email")
        .eq("email", email.toLowerCase())
        .eq("customer_email", actualCustomerEmail.toLowerCase())
        .single();

      if (existingVendor) {
        return JSON.stringify({
          success: false,
          error: `Vendor with email ${email} already exists in your database: ${existingVendor.name}`,
          existing_vendor: existingVendor,
        });
      }

      let gstDetails: any = null;
      if (gstin) {
        const { lookupVendor } = await import("@/lib/gstVerify");
        gstDetails = await lookupVendor(gstin);

        if (!gstDetails.valid) {
          return JSON.stringify({
            success: false,
            error: `That GSTIN is not valid. ${gstDetails.reason}`,
          });
        }
      }

      // Insert new vendor
      const { data, error } = await supabase
        .from("vendors")
        .insert({
          name: gstDetails?.legal_name || name.trim(),
          email: email.toLowerCase().trim(),
          customer_email: actualCustomerEmail.toLowerCase().trim(),
          website: website?.trim() || null,
          address: gstDetails?.address || address?.trim() || null,
          phone: phone?.trim() || null,
          gstin: gstDetails?.gstin || null,
          legal_name: gstDetails?.legal_name || null,
          state_code: gstDetails?.state_code || null,
          is_msme: typeof is_msme === "boolean" ? is_msme : gstDetails?.is_msme ?? null,
          udyam_number: udyam_number?.trim() || gstDetails?.udyam_number || null,
          msme_verified_at: gstin || typeof is_msme === "boolean" ? new Date().toISOString() : null,
        })
        .select()
        .single();

      if (error) {
        return JSON.stringify({
          success: false,
          error: `Failed to add vendor: ${error.message}`,
        });
      }

      if (gstDetails) {
        return JSON.stringify({
          success: true,
          message: `Vendor "${data.name}" added and GSTIN verified.`,
          vendor: data,
          gstin_verified: true,
          state: gstDetails.state,
          pan: gstDetails.pan,
          entity_type: gstDetails.entity_type,
          is_msme: data.is_msme,
          msme_note:
            data.is_msme === true
              ? "Registered as a micro or small enterprise. The 45-day payment rule applies to every order placed with them."
              : data.is_msme === false
              ? "Not an MSME, so the 45-day rule does not apply."
              : gstDetails.registry_note || "MSME status unknown. Ask the vendor whether they are Udyam registered.",
        });
      }

      return JSON.stringify({
        success: true,
        message: `Vendor "${name}" added successfully!`,
        vendor: {
          id: data.id,
          name: data.name,
          email: data.email,
          website: data.website,
          address: data.address,
          phone: data.phone,
        },
      });
    } catch (error: any) {
      return JSON.stringify({
        success: false,
        error: `Failed to add vendor: ${error.message}`,
      });
    }
  },
  {
    name: "add_vendor",
    description: `Add a new vendor to the database.

Use this tool when user wants to:
- Add a new supplier/vendor
- Register a vendor for future auctions
- Save vendor contact details
- Import vendor information

The tool will:
1. Validate the email format
2. Check if vendor already exists (prevents duplicates)
3. Save vendor details to database
4. Return confirmation with vendor ID

Required fields:
- name: Vendor/company name
- email: Valid email address (used as unique identifier)

Optional fields:
- website: Company website URL
- address: Physical address
- phone: Contact phone number
- gstin: 15-character GST number. When given, it is checked against the official
  format and check digit, and the state, PAN and entity type are decoded.
  An invalid GSTIN is rejected outright.
- is_msme: whether the vendor is a Udyam-registered micro or small enterprise.
  This decides whether India's 45-day payment rule applies to them, so ask for it
  whenever the user is adding an Indian supplier.
- udyam_number: their Udyam registration, for example UDYAM-MH-03-0000001`,
    schema: z.object({
      name: z.string().describe("Vendor/company name (REQUIRED)"),
      email: z.string().describe("Vendor email address (REQUIRED, must be valid)"),
      gstin: z.string().optional().describe("15-character GSTIN, for example 27AAPFU0939F1ZV"),
      is_msme: z.boolean().optional().describe("True if the vendor is a Udyam-registered micro or small enterprise"),
      udyam_number: z.string().optional().describe("Udyam registration number if known"),
      website: z.string().optional().describe("Company website URL (optional)"),
      address: z.string().optional().describe("Physical address (optional)"),
      phone: z.string().optional().describe("Contact phone number (optional)"),
      customer_email: z.string().optional().describe("Customer email (auto-retrieved from user context if not provided)"),
    }),
  }
);

// TOOL 2: Add Multiple Vendors (Bulk Import)
export const addVendorsBulkTool = tool(
  async ({ vendors_data, customer_email }, config) => {
    try {
      // Get customer email from config if not provided
      const actualCustomerEmail = customer_email || config?.configurable?.customerEmail;
      
      if (!actualCustomerEmail) {
        return JSON.stringify({
          success: false,
          error: 'Customer email is required to add vendors. Please ensure you are logged in.',
        });
      }

      // Parse vendors from the input
      let vendorsToAdd: Array<{ name: string; email: string; website?: string; address?: string; phone?: string }> = [];

      // Try to parse as JSON first
      try {
        const parsed = JSON.parse(vendors_data);
        if (Array.isArray(parsed)) {
          vendorsToAdd = parsed;
        } else if (parsed.name && parsed.email) {
          vendorsToAdd = [parsed];
        }
      } catch {
        // If not JSON, try to parse as text
        const parsedVendors = parseVendorsFromText(vendors_data);
        vendorsToAdd = parsedVendors;
      }

      if (vendorsToAdd.length === 0) {
        return JSON.stringify({
          success: false,
          error: "Could not parse vendor data. Please provide in format: Name - email@example.com (one per line)",
        });
      }

      const results = {
        total: vendorsToAdd.length,
        added: 0,
        skipped: 0,
        failed: 0,
        details: [] as any[],
      };

      for (const vendor of vendorsToAdd) {
        const { name, email, website, address, phone } = vendor;

        // Validate email
        if (!validateEmail(email)) {
          results.failed++;
          results.details.push({
            name,
            email,
            status: "failed",
            reason: "Invalid email format",
          });
          continue;
        }

        // Check if exists for this customer
        const { data: existingVendor } = await supabase
          .from("vendors")
          .select("id, name, email")
          .eq("email", email.toLowerCase())
          .eq("customer_email", actualCustomerEmail.toLowerCase())
          .single();

        if (existingVendor) {
          results.skipped++;
          results.details.push({
            name,
            email,
            status: "skipped",
            reason: "Already exists",
          });
          continue;
        }

        // Insert vendor
        const { data, error } = await supabase
          .from("vendors")
          .insert({
            name: name.trim(),
            email: email.toLowerCase().trim(),
            customer_email: actualCustomerEmail.toLowerCase().trim(),
            website: website?.trim() || null,
            address: address?.trim() || null,
            phone: phone?.trim() || null,
          })
          .select()
          .single();

        if (error) {
          results.failed++;
          results.details.push({
            name,
            email,
            status: "failed",
            reason: error.message,
          });
        } else {
          results.added++;
          results.details.push({
            name: data.name,
            email: data.email,
            status: "added",
            id: data.id,
          });
        }
      }

      return JSON.stringify({
        success: true,
        message: `Bulk import completed: ${results.added} added, ${results.skipped} skipped, ${results.failed} failed`,
        summary: {
          total: results.total,
          added: results.added,
          skipped: results.skipped,
          failed: results.failed,
        },
        details: results.details,
      });
    } catch (error: any) {
      return JSON.stringify({
        success: false,
        error: `Failed to add vendors: ${error.message}`,
      });
    }
  },
  {
    name: "add_vendors_bulk",
    description: `Add multiple vendors at once from text, JSON, or document content.

Use this tool when user wants to:
- Import multiple vendors at once
- Add vendors from a list or document
- Bulk register suppliers

Supported formats:
1. JSON array: [{"name": "ABC Corp", "email": "abc@corp.com"}, ...]
2. Text format (one per line):
   - "Company Name - email@example.com"
   - "email@example.com - Company Name"
   - "Company Name, email@example.com"
3. Mixed format with optional fields

The tool will:
- Parse vendor data from various formats
- Validate emails
- Skip duplicates
- Return detailed results for each vendor

Example inputs:
- "ABC Corp - abc@corp.com
   XYZ Ltd - xyz@ltd.com
   PQR Industries - pqr@industries.com"
- '[{"name": "ABC Corp", "email": "abc@corp.com", "phone": "1234567890"}]'`,
    schema: z.object({
      vendors_data: z
        .string()
        .describe(
          "Vendor data in JSON format or text format (Name - email@example.com, one per line)"
        ),
      customer_email: z.string().optional().describe("Customer email (auto-retrieved from user context if not provided)"),
    }),
  }
);

// TOOL 3: List/Display All Vendors
export const listVendorsTool = tool(
  async ({ limit, search_query, customer_email }, config) => {
    try {
      // Get customer email from config if not provided
      const actualCustomerEmail = customer_email || config?.configurable?.customerEmail;
      
      if (!actualCustomerEmail) {
        return JSON.stringify({
          success: false,
          error: 'Customer email is required to list vendors. Please ensure you are logged in.',
        });
      }

      let query = supabase
        .from("vendors")
        .select("*")
        .eq("customer_email", actualCustomerEmail.toLowerCase())
        .order("created_at", { ascending: false });

      // Apply search filter if provided
      if (search_query) {
        query = query.or(
          `name.ilike.%${search_query}%,email.ilike.%${search_query}%,website.ilike.%${search_query}%,address.ilike.%${search_query}%`
        );
      }

      // Apply limit
      if (limit) {
        query = query.limit(limit);
      }

      const { data: vendors, error } = await query;

      if (error) {
        return JSON.stringify({
          success: false,
          error: `Failed to fetch vendors: ${error.message}`,
        });
      }

      if (!vendors || vendors.length === 0) {
        return JSON.stringify({
          success: true,
          message: search_query
            ? `No vendors found matching "${search_query}"`
            : "No vendors in database. Add vendors using add_vendor or add_vendors_bulk tool.",
          vendors: [],
          count: 0,
        });
      }

      // Format vendors in table structure
      const formattedVendors = vendors.map((v) => ({
        ID: v.id.substring(0, 8) + "...",
        Name: v.name,
        Email: v.email,
        Website: v.website || "N/A",
        Address: v.address || "N/A",
        Phone: v.phone || "N/A",
        "Total Auctions": v.total_auctions_participated || 0,
        "Total Wins": v.total_wins || 0,
        "Created At": new Date(v.created_at).toLocaleDateString(),
      }));

      return JSON.stringify({
        success: true,
        message: search_query
          ? `Found ${vendors.length} vendor(s) matching "${search_query}"`
          : `Total vendors in database: ${vendors.length}`,
        count: vendors.length,
        vendors: formattedVendors,
        raw_data: vendors, // Include raw data for potential further processing
      });
    } catch (error: any) {
      return JSON.stringify({
        success: false,
        error: `Failed to list vendors: ${error.message}`,
      });
    }
  },
  {
    name: "list_vendors",
    description: `List and display all vendors from the database in a formatted table.

Use this tool when user wants to:
- View all vendors
- Display vendor list
- Show suppliers in database
- Search for specific vendors
- Check vendor details

The tool will:
- Fetch vendors from database
- Format data in a clean table structure
- Show key information: Name, Email, Website, Address, Phone
- Include vendor statistics (auctions participated, wins)
- Support search/filtering by name, email, or address

Optional parameters:
- limit: Maximum number of vendors to return (useful for large databases)
- search_query: Search term to filter vendors by name, email, website, or address

Returns:
- Formatted table data
- Total vendor count
- Individual vendor details`,
    schema: z.object({
      limit: z.number().optional().describe("Maximum number of vendors to return (optional)"),
      search_query: z.string().optional().describe("Search term to filter vendors (optional)"),
      customer_email: z.string().optional().describe("Customer email (auto-retrieved from user context if not provided)"),
    }),
  }
);

// TOOL 4: Delete Vendor
export const deleteVendorTool = tool(
  async ({ vendor_email, customer_email }, config) => {
    try {
      // Get customer email from config if not provided
      const actualCustomerEmail = customer_email || config?.configurable?.customerEmail;
      
      if (!actualCustomerEmail) {
        return JSON.stringify({
          success: false,
          error: 'Customer email is required to delete vendors. Please ensure you are logged in.',
        });
      }

      // Find vendor by email for this customer
      const { data: vendor, error: findError } = await supabase
        .from("vendors")
        .select("*")
        .eq("email", vendor_email.toLowerCase())
        .eq("customer_email", actualCustomerEmail.toLowerCase())
        .single();

      if (findError || !vendor) {
        return JSON.stringify({
          success: false,
          error: `Vendor with email ${vendor_email} not found in your database`,
        });
      }

      // Delete vendor
      const { error: deleteError } = await supabase
        .from("vendors")
        .delete()
        .eq("email", vendor_email.toLowerCase())
        .eq("customer_email", actualCustomerEmail.toLowerCase());

      if (deleteError) {
        return JSON.stringify({
          success: false,
          error: `Failed to delete vendor: ${deleteError.message}`,
        });
      }

      return JSON.stringify({
        success: true,
        message: `Vendor "${vendor.name}" (${vendor_email}) deleted successfully`,
        deleted_vendor: {
          id: vendor.id,
          name: vendor.name,
          email: vendor.email,
        },
      });
    } catch (error: any) {
      return JSON.stringify({
        success: false,
        error: `Failed to delete vendor: ${error.message}`,
      });
    }
  },
  {
    name: "delete_vendor",
    description: `Delete a vendor from the database by email address.

Use this tool when user wants to:
- Remove a vendor from database
- Delete supplier contact
- Clean up vendor list

Note: This will permanently delete the vendor record. Use with caution.`,
    schema: z.object({
      vendor_email: z.string().describe("Email address of the vendor to delete"),
      customer_email: z.string().optional().describe("Customer email (auto-retrieved from user context if not provided)"),
    }),
  }
);
