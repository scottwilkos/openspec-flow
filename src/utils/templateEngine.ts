/**
 * OpenSpec-Flow Template Engine
 * Mustache/Handlebars-style variable interpolation
 */

import { existsSync, readFileSync, writeFileSync, mkdirSync, readdirSync, statSync } from 'fs';
import { join, dirname } from 'path';
import { loadConfig, getFlatConfig, getPatternsList, getConstraintsList } from './configLoader.js';
import { OpenSpecFlowConfig } from './configSchema.js';

/**
 * Interpolation options
 */
export interface InterpolationOptions {
  /** Custom variables to add (override config values) */
  variables?: Record<string, string | number | boolean>;
  /** Whether to throw on missing variables (default: false, leaves unchanged) */
  strict?: boolean;
  /** Custom config (instead of loading from disk) */
  config?: OpenSpecFlowConfig;
}

/**
 * Interpolate Mustache-style variables in a string
 * Supports: {{variable}}, {{variable.nested.path}}
 *
 * @param template - Template string with {{variables}}
 * @param options - Interpolation options
 * @returns Interpolated string
 */
export function interpolate(template: string, options: InterpolationOptions = {}): string {
  const config = options.config || loadConfig();
  const flatConfig = getFlatConfig(config);

  // Merge custom variables (override config values)
  const variables: Record<string, string | number | boolean> = {
    ...flatConfig,
    ...options.variables,
  };

  // Add array variables for iteration
  const patterns = getPatternsList(config);
  const constraints = getConstraintsList(config);

  // Process {{#each patterns}}...{{/each}} blocks
  let result = template;
  result = processEachBlock(result, 'patterns', patterns);
  result = processEachBlock(result, 'constraints', constraints);
  result = processEachBlock(result, 'tech.patterns', patterns);

  // Process simple {{variable}} replacements
  result = result.replace(/\{\{([^}#/]+)\}\}/g, (match, key) => {
    const trimmedKey = key.trim();

    // Check if variable exists
    if (trimmedKey in variables) {
      const value = variables[trimmedKey];
      return String(value);
    }

    // Handle missing variables
    if (options.strict) {
      throw new Error(`Missing template variable: ${trimmedKey}`);
    }

    // Leave unchanged if not strict
    return match;
  });

  return result;
}

/**
 * Process {{#each array}}...{{/each}} blocks
 */
function processEachBlock(template: string, arrayName: string, items: string[]): string {
  const regex = new RegExp(
    `\\{\\{#each\\s+${arrayName}\\}\\}([\\s\\S]*?)\\{\\{/each\\}\\}`,
    'g'
  );

  return template.replace(regex, (_, content) => {
    return items
      .map(item => {
        // Replace {{this}} with the current item
        return content.replace(/\{\{this\}\}/g, item);
      })
      .join('');
  });
}

/**
 * Process a template file and return interpolated content
 *
 * @param templatePath - Path to template file (.md.template, .yaml.template, etc.)
 * @param options - Interpolation options
 * @returns Interpolated content
 */
export function processTemplateFile(
  templatePath: string,
  options: InterpolationOptions = {}
): string {
  if (!existsSync(templatePath)) {
    throw new Error(`Template file not found: ${templatePath}`);
  }

  const template = readFileSync(templatePath, 'utf-8');
  return interpolate(template, options);
}

/**
 * Process a template file and write the result
 *
 * @param templatePath - Path to template file
 * @param outputPath - Path to write output
 * @param options - Interpolation options
 */
export function processAndWriteTemplate(
  templatePath: string,
  outputPath: string,
  options: InterpolationOptions = {}
): void {
  const content = processTemplateFile(templatePath, options);

  // Ensure output directory exists
  const outputDir = dirname(outputPath);
  if (!existsSync(outputDir)) {
    mkdirSync(outputDir, { recursive: true });
  }

  writeFileSync(outputPath, content, 'utf-8');
}

/**
 * Process multiple templates from a directory
 *
 * @param templateDir - Directory containing .template files
 * @param outputDir - Directory to write processed files
 * @param options - Interpolation options
 * @returns List of processed files
 */
export function processTemplateDirectory(
  templateDir: string,
  outputDir: string,
  options: InterpolationOptions = {}
): string[] {
  const processed: string[] = [];

  if (!existsSync(templateDir)) {
    return processed;
  }

  const entries = readdirSync(templateDir);

  for (const entry of entries) {
    const templatePath = join(templateDir, entry);
    const stat = statSync(templatePath);

    if (stat.isDirectory()) {
      // Recursively process subdirectories
      const subOutputDir = join(outputDir, entry);
      const subProcessed = processTemplateDirectory(templatePath, subOutputDir, options);
      processed.push(...subProcessed);
    } else if (entry.endsWith('.template')) {
      // Remove .template extension for output
      const outputName = entry.replace(/\.template$/, '');
      const outputPath = join(outputDir, outputName);

      processAndWriteTemplate(templatePath, outputPath, options);
      processed.push(outputPath);
    }
  }

  return processed;
}

/**
 * Get list of available template variables
 * Useful for documentation and debugging
 */
export function getAvailableVariables(): string[] {
  const flatConfig = getFlatConfig();
  return Object.keys(flatConfig).sort();
}

/**
 * Validate a template for missing variables
 *
 * @param template - Template string to validate
 * @returns Object with valid flag and list of missing variables
 */
export function validateTemplate(template: string): {
  valid: boolean;
  missing: string[];
  found: string[];
} {
  const flatConfig = getFlatConfig();
  const variableRegex = /\{\{([^}#/]+)\}\}/g;
  const found: string[] = [];
  const missing: string[] = [];

  let match;
  while ((match = variableRegex.exec(template)) !== null) {
    const key = match[1].trim();

    // Skip special keywords
    if (key === 'this') continue;

    if (key in flatConfig) {
      if (!found.includes(key)) {
        found.push(key);
      }
    } else {
      if (!missing.includes(key)) {
        missing.push(key);
      }
    }
  }

  return {
    valid: missing.length === 0,
    missing,
    found,
  };
}

/**
 * Escape special characters in template content
 * Use when embedding user content that might contain {{ }}
 */
export function escapeTemplate(content: string): string {
  return content.replace(/\{\{/g, '\\{\\{').replace(/\}\}/g, '\\}\\}');
}

/**
 * Unescape template content
 */
export function unescapeTemplate(content: string): string {
  return content.replace(/\\\{\\{/g, '{{').replace(/\\\}\\}/g, '}}');
}
