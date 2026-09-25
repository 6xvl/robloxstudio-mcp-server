export type ToolCategory = 'read' | 'write';

export interface ToolDefinition {
  name: string;
  description: string;
  category: ToolCategory;
  inputSchema: object;
}

export const TOOL_DEFINITIONS: ToolDefinition[] = [
  // === File & Instance Browsing ===
  {
    name: 'get_file_tree',
    category: 'read',
    description: 'Get instance hierarchy tree from Studio',
    inputSchema: {
      type: 'object',
      properties: {
        path: {
          type: 'string',
          description: 'Root path (default: game root)'
        }
      }
    }
  },
  {
    name: 'search_files',
    category: 'read',
    description: 'Search instances by name, class, or script content',
    inputSchema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'Name, class, or code pattern'
        },
        searchType: {
          type: 'string',
          enum: ['name', 'type', 'content'],
          description: 'Search mode (default: name)'
        }
      },
      required: ['query']
    }
  },

  // === Place & Service Info ===
  {
    name: 'get_place_info',
    category: 'read',
    description: 'Get place ID, name, and game settings',
    inputSchema: {
      type: 'object',
      properties: {}
    }
  },
  {
    name: 'get_services',
    category: 'read',
    description: 'Get available services and their children',
    inputSchema: {
      type: 'object',
      properties: {
        serviceName: {
          type: 'string',
          description: 'Specific service name'
        }
      }
    }
  },
  {
    name: 'search_objects',
    category: 'read',
    description: 'Find instances by name, class, or properties',
    inputSchema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'Search query'
        },
        searchType: {
          type: 'string',
          enum: ['name', 'class', 'property'],
          description: 'Search mode (default: name)'
        },
        propertyName: {
          type: 'string',
          description: 'Property name when searchType is "property"'
        }
      },
      required: ['query']
    }
  },

  // === Instance Inspection ===
  {
    name: 'get_instance_properties',
    category: 'read',
    description: 'Get all properties of an instance',
    inputSchema: {
      type: 'object',
      properties: {
        instancePath: {
          type: 'string',
          description: 'Instance path (dot notation)'
        },
        excludeSource: {
          type: 'boolean',
          description: 'For scripts, return SourceLength/LineCount instead of full source (default: false)'
        }
      },
      required: ['instancePath']
    }
  },
  {
    name: 'get_instance_children',
    category: 'read',
    description: 'Get children and their class types',
    inputSchema: {
      type: 'object',
      properties: {
        instancePath: {
          type: 'string',
          description: 'Instance path (dot notation)'
        }
      },
      required: ['instancePath']
    }
  },
  {
    name: 'search_by_property',
    category: 'read',
    description: 'Find objects with specific property values',
    inputSchema: {
      type: 'object',
      properties: {
        propertyName: {
          type: 'string',
          description: 'Property name'
        },
        propertyValue: {
          type: 'string',
          description: 'Value to match'
        }
      },
      required: ['propertyName', 'propertyValue']
    }
  },
  {
    name: 'get_class_info',
    category: 'read',
    description: 'Get properties/methods for a class',
    inputSchema: {
      type: 'object',
      properties: {
        className: {
          type: 'string',
          description: 'Roblox class name'
        }
      },
      required: ['className']
    }
  },

  // === Project Structure ===
  {
    name: 'get_project_structure',
    category: 'read',
    description: 'Get full game hierarchy tree. Increase maxDepth (default 3) for deeper traversal.',
    inputSchema: {
      type: 'object',
      properties: {
        path: {
          type: 'string',
          description: 'Root path (default: workspace root)'
        },
        maxDepth: {
          type: 'number',
          description: 'Max traversal depth (default: 3)'
        },
        scriptsOnly: {
          type: 'boolean',
          description: 'Show only scripts (default: false)'
        }
      }
    }
  },

  // === Property Write ===
  {
    name: 'set_property',
    category: 'write',
    description: 'Set a property on an instance',
    inputSchema: {
      type: 'object',
      properties: {
        instancePath: {
          type: 'string',
          description: 'Instance path (dot notation)'
        },
        propertyName: {
          type: 'string',
          description: 'Property name'
        },
        propertyValue: {
          description: 'Value to set (string, number, boolean, or object for Vector3/Color3/UDim2)'
        }
      },
      required: ['instancePath', 'propertyName', 'propertyValue']
    }
  },
  {
    name: 'mass_set_property',
    category: 'write',
    description: 'Set a property on multiple instances',
    inputSchema: {
      type: 'object',
      properties: {
        paths: {
          type: 'array',
          items: { type: 'string' },
          description: 'Instance paths'
        },
        propertyName: {
          type: 'string',
          description: 'Property name'
        },
        propertyValue: {
          description: 'Value to set (string, number, boolean, or object for Vector3/Color3/UDim2)'
        }
      },
      required: ['paths', 'propertyName', 'propertyValue']
    }
  },
  {
    name: 'mass_get_property',
    category: 'read',
    description: 'Get a property from multiple instances',
    inputSchema: {
      type: 'object',
      properties: {
        paths: {
          type: 'array',
          items: { type: 'string' },
          description: 'Instance paths'
        },
        propertyName: {
          type: 'string',
          description: 'Property name'
        }
      },
      required: ['paths', 'propertyName']
    }
  },
  {
    name: 'set_properties',
    category: 'write',
    description: 'Set multiple properties on a single instance in one call.',
    inputSchema: {
      type: 'object',
      properties: {
        instancePath: {
          type: 'string',
          description: 'Instance path'
        },
        properties: {
          type: 'object',
          description: 'Map of property name to value'
        }
      },
      required: ['instancePath', 'properties']
    }
  },

  // === Object Creation/Deletion ===
  {
    name: 'create_object',
    category: 'write',
    description: 'Create a new instance. Optionally set properties on creation.',
    inputSchema: {
      type: 'object',
      properties: {
        className: {
          type: 'string',
          description: 'Roblox class name'
        },
        parent: {
          type: 'string',
          description: 'Parent instance path'
        },
        name: {
          type: 'string',
          description: 'Optional name'
        },
        properties: {
          type: 'object',
          description: 'Properties to set on creation'
        }
      },
      required: ['className', 'parent']
    }
  },
  {
    name: 'mass_create_objects',
    category: 'write',
    description: 'Create multiple instances. Each can have optional properties.',
    inputSchema: {
      type: 'object',
      properties: {
        objects: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              className: {
                type: 'string',
                description: 'Roblox class name'
              },
              parent: {
                type: 'string',
                description: 'Parent instance path'
              },
              name: {
                type: 'string',
                description: 'Optional name'
              },
              properties: {
                type: 'object',
                description: 'Properties to set on creation'
              }
            },
            required: ['className', 'parent']
          },
          description: 'Objects to create'
        }
      },
      required: ['objects']
    }
  },
  {
    name: 'delete_object',
    category: 'write',
    description: 'Delete an instance',
    inputSchema: {
      type: 'object',
      properties: {
        instancePath: {
          type: 'string',
          description: 'Instance path (dot notation)'
        }
      },
      required: ['instancePath']
    }
  },

  // === Duplication ===
  {
    name: 'smart_duplicate',
    category: 'write',
    description: 'Duplicate with naming, positioning, and property variations',
    inputSchema: {
      type: 'object',
      properties: {
        instancePath: {
          type: 'string',
          description: 'Instance path (dot notation)'
        },
        count: {
          type: 'number',
          description: 'Number of duplicates'
        },
        options: {
          type: 'object',
          properties: {
            namePattern: {
              type: 'string',
              description: 'Name pattern ({n} placeholder)'
            },
            positionOffset: {
              type: 'array',
              items: { type: 'number' },
              description: 'X, Y, Z offset per duplicate'
            },
            rotationOffset: {
              type: 'array',
              items: { type: 'number' },
              description: 'X, Y, Z rotation offset'
            },
            scaleOffset: {
              type: 'array',
              items: { type: 'number' },
              description: 'X, Y, Z scale multiplier'
            },
            propertyVariations: {
              type: 'object',
              description: 'Property name to array of values'
            },
            targetParents: {
              type: 'array',
              items: { type: 'string' },
              description: 'Different parent per duplicate'
            }
          }
        }
      },
      required: ['instancePath', 'count']
    }
  },
  {
    name: 'mass_duplicate',
    category: 'write',
    description: 'Batch smart_duplicate operations',
    inputSchema: {
      type: 'object',
      properties: {
        duplications: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              instancePath: {
                type: 'string',
                description: 'Instance path (dot notation)'
              },
              count: {
                type: 'number',
                description: 'Number of duplicates'
              },
              options: {
                type: 'object',
                properties: {
                  namePattern: {
                    type: 'string',
                    description: 'Name pattern ({n} placeholder)'
                  },
                  positionOffset: {
                    type: 'array',
                    items: { type: 'number' },
                    description: 'X, Y, Z offset per duplicate'
                  },
                  rotationOffset: {
                    type: 'array',
                    items: { type: 'number' },
                    description: 'X, Y, Z rotation offset'
                  },
                  scaleOffset: {
                    type: 'array',
                    items: { type: 'number' },
                    description: 'X, Y, Z scale multiplier'
                  },
                  propertyVariations: {
                    type: 'object',
                    description: 'Property name to array of values'
                  },
                  targetParents: {
                    type: 'array',
                    items: { type: 'string' },
                    description: 'Different parent per duplicate'
                  }
                }
              }
            },
            required: ['instancePath', 'count']
          },
          description: 'Duplication operations'
        }
      },
      required: ['duplications']
    }
  },

  // === Calculated/Relative Properties ===
  // === Script Read/Write ===
  {
    name: 'get_script_source',
    category: 'read',
    description: 'Get script source. Returns "source" and "numberedSource" (line-numbered). Use startLine/endLine for large scripts.',
    inputSchema: {
      type: 'object',
      properties: {
        instancePath: {
          type: 'string',
          description: 'Script instance path'
        },
        startLine: {
          type: 'number',
          description: 'Start line (1-indexed)'
        },
        endLine: {
          type: 'number',
          description: 'End line (inclusive)'
        }
      },
      required: ['instancePath']
    }
  },
  {
    name: 'set_script_source',
    category: 'write',
    description: 'Replace entire script source. For partial edits use edit/insert/delete_script_lines.',
    inputSchema: {
      type: 'object',
      properties: {
        instancePath: {
          type: 'string',
          description: 'Script instance path'
        },
        source: {
          type: 'string',
          description: 'New source code'
        }
      },
      required: ['instancePath', 'source']
    }
  },
  {
    name: 'edit_script_lines',
    category: 'write',
    description: 'Replace exact text in a script. Without startLine, old_string must match exactly once in the script. Pass startLine (1-indexed, from get_script_source) to anchor the edit to a specific line when old_string is ambiguous (e.g. repeated closing braces).',
    inputSchema: {
      type: 'object',
      properties: {
        instancePath: {
          type: 'string',
          description: 'Script instance path'
        },
        old_string: {
          type: 'string',
          description: 'Exact text to find and replace. Must be unique in the script unless startLine is provided.'
        },
        new_string: {
          type: 'string',
          description: 'Replacement text'
        },
        startLine: {
          type: 'number',
          description: 'Optional 1-indexed line where old_string begins. When provided, skips uniqueness check and requires old_string to match starting at that exact line.'
        }
      },
      required: ['instancePath', 'old_string', 'new_string']
    }
  },
  {
    name: 'insert_script_lines',
    category: 'write',
    description: 'Insert lines after a given line number (0 = beginning).',
    inputSchema: {
      type: 'object',
      properties: {
        instancePath: {
          type: 'string',
          description: 'Script instance path'
        },
        afterLine: {
          type: 'number',
          description: 'Insert after this line (0 = beginning)'
        },
        newContent: {
          type: 'string',
          description: 'Content to insert'
        }
      },
      required: ['instancePath', 'newContent']
    }
  },
  {
    name: 'delete_script_lines',
    category: 'write',
    description: 'Delete a range of lines. 1-indexed, inclusive.',
    inputSchema: {
      type: 'object',
      properties: {
        instancePath: {
          type: 'string',
          description: 'Script instance path'
        },
        startLine: {
          type: 'number',
          description: 'Start line (1-indexed)'
        },
        endLine: {
          type: 'number',
          description: 'End line (inclusive)'
        }
      },
      required: ['instancePath', 'startLine', 'endLine']
    }
  },

  // === Attributes ===
  {
    name: 'set_attribute',
    category: 'write',
    description: 'Set an attribute. Supports primitives, Vector3, Color3, UDim2, BrickColor.',
    inputSchema: {
      type: 'object',
      properties: {
        instancePath: {
          type: 'string',
          description: 'Instance path (dot notation)'
        },
        attributeName: {
          type: 'string',
          description: 'Attribute name'
        },
        attributeValue: {
          description: 'Value (string, number, boolean, or object for Vector3/Color3/UDim2)'
        },
        valueType: {
          type: 'string',
          description: 'Type hint if needed'
        }
      },
      required: ['instancePath', 'attributeName', 'attributeValue']
    }
  },
  {
    name: 'get_attributes',
    category: 'read',
    description: 'Get all attributes on an instance',
    inputSchema: {
      type: 'object',
      properties: {
        instancePath: {
          type: 'string',
          description: 'Instance path (dot notation)'
        }
      },
      required: ['instancePath']
    }
  },
  {
    name: 'delete_attribute',
    category: 'write',
    description: 'Delete an attribute',
    inputSchema: {
      type: 'object',
      properties: {
        instancePath: {
          type: 'string',
          description: 'Instance path (dot notation)'
        },
        attributeName: {
          type: 'string',
          description: 'Attribute name'
        }
      },
      required: ['instancePath', 'attributeName']
    }
  },

  // === Tags ===
  {
    name: 'get_tags',
    category: 'read',
    description: 'Get all tags on an instance',
    inputSchema: {
      type: 'object',
      properties: {
        instancePath: {
          type: 'string',
          description: 'Instance path (dot notation)'
        }
      },
      required: ['instancePath']
    }
  },
  {
    name: 'add_tag',
    category: 'write',
    description: 'Add a tag',
    inputSchema: {
      type: 'object',
      properties: {
        instancePath: {
          type: 'string',
          description: 'Instance path (dot notation)'
        },
        tagName: {
          type: 'string',
          description: 'Tag name'
        }
      },
      required: ['instancePath', 'tagName']
    }
  },
  {
    name: 'remove_tag',
    category: 'write',
    description: 'Remove a tag',
    inputSchema: {
      type: 'object',
      properties: {
        instancePath: {
          type: 'string',
          description: 'Instance path (dot notation)'
        },
        tagName: {
          type: 'string',
          description: 'Tag name'
        }
      },
      required: ['instancePath', 'tagName']
    }
  },
  {
    name: 'get_tagged',
    category: 'read',
    description: 'Get all instances with a specific tag',
    inputSchema: {
      type: 'object',
      properties: {
        tagName: {
          type: 'string',
          description: 'Tag name'
        }
      },
      required: ['tagName']
    }
  },

  // === Selection ===
  {
    name: 'get_selection',
    category: 'read',
    description: 'Get all currently selected objects',
    inputSchema: {
      type: 'object',
      properties: {}
    }
  },

  // === Luau Execution ===
  {
    name: 'execute_luau',
    category: 'write',
    description: 'Execute Luau code in plugin context. Use print()/warn() for output. Return value is captured.',
    inputSchema: {
      type: 'object',
      properties: {
        code: {
          type: 'string',
          description: 'Luau code to execute'
        },
        target: {
          type: 'string',
          description: 'Instance target: "edit" (default), "server", "client-1", "client-2", etc.'
        }
      },
      required: ['code']
    }
  },

  // === Script Search ===
  {
    name: 'grep_scripts',
    category: 'read',
    description: 'Ripgrep-inspired search across all script sources. Supports literal and Lua pattern matching, context lines, early termination, and results grouped by script with line/column numbers.',
    inputSchema: {
      type: 'object',
      properties: {
        pattern: {
          type: 'string',
          description: 'Search pattern (literal string or Lua pattern)'
        },
        caseSensitive: {
          type: 'boolean',
          description: 'Case-sensitive search (default: false)'
        },
        usePattern: {
          type: 'boolean',
          description: 'Use Lua pattern matching instead of literal (default: false)'
        },
        contextLines: {
          type: 'number',
          description: 'Number of context lines before/after each match (default: 0)'
        },
        maxResults: {
          type: 'number',
          description: 'Max total matches before stopping (default: 100)'
        },
        maxResultsPerScript: {
          type: 'number',
          description: 'Max matches per script (like rg -m)'
        },
        filesOnly: {
          type: 'boolean',
          description: 'Only return matching script paths, not line details (default: false)'
        },
        path: {
          type: 'string',
          description: 'Subtree to search (e.g. "game.ServerScriptService")'
        },
        classFilter: {
          type: 'string',
          enum: ['Script', 'LocalScript', 'ModuleScript'],
          description: 'Only search scripts of this class type'
        }
      },
      required: ['pattern']
    }
  },

  // === Playtest ===
  {
    name: 'start_playtest',
    category: 'write',
    description: 'Start playtest. Captures print/warn/error via LogService. Poll with get_playtest_output, end with stop_playtest. Use numPlayers for multi-client testing (server + N clients).',
    inputSchema: {
      type: 'object',
      properties: {
        mode: {
          type: 'string',
          enum: ['play', 'run'],
          description: 'Play mode'
        },
        numPlayers: {
          type: 'number',
          description: 'Number of client players (1-8). Triggers server + clients mode via TestService.'
        }
      },
      required: ['mode']
    }
  },
  {
    name: 'stop_playtest',
    category: 'write',
    description: 'Stop playtest and return all captured output.',
    inputSchema: {
      type: 'object',
      properties: {}
    }
  },
  {
    name: 'get_playtest_output',
    category: 'read',
    description: 'Poll output buffer without stopping. Returns isRunning and captured messages.',
    inputSchema: {
      type: 'object',
      properties: {
        target: {
          type: 'string',
          description: 'Instance target: "edit" (default), "server", "client-1", "client-2", etc.'
        }
      }
    }
  },

  // === Multi-Instance ===
  {
    name: 'get_connected_instances',
    category: 'read',
    description: 'List all connected plugin instances with their roles. Use during multi-client playtest to discover server and client instances for targeted commands.',
    inputSchema: {
      type: 'object',
      properties: {}
    }
  },

  // === Undo/Redo ===
  {
    name: 'undo',
    category: 'write',
    description: 'Undo the last change in Roblox Studio. Uses ChangeHistoryService to reverse the most recent operation.',
    inputSchema: {
      type: 'object',
      properties: {}
    }
  },
  {
    name: 'redo',
    category: 'write',
    description: 'Redo the last undone change in Roblox Studio. Uses ChangeHistoryService to reapply the most recently undone operation.',
    inputSchema: {
      type: 'object',
      properties: {}
    }
  },

  // === Build Library ===
  {
    name: 'export_build',
    category: 'read',
    description: 'Export a Model/Folder into a compact, token-efficient build JSON format and auto-save it to the local build library. The output contains a palette (unique BrickColor+Material combos mapped to short keys) and compact part arrays with positions normalized relative to the bounding box center. The file is saved to build-library/{style}/{id}.json automatically.',
    inputSchema: {
      type: 'object',
      properties: {
        instancePath: {
          type: 'string',
          description: 'Path to the Model or Folder to export (dot notation)'
        },
        outputId: {
          type: 'string',
          description: 'Build ID for the output (e.g. "medieval/cottage_01"). Defaults to style/instance_name.'
        },
        style: {
          type: 'string',
          enum: ['medieval', 'modern', 'nature', 'scifi', 'misc'],
          description: 'Style category for the build (default: misc)'
        }
      },
      required: ['instancePath']
    }
  },
  {
    name: 'create_build',
    category: 'write',
    description: 'Create a new build model from scratch and save it to the library. Define parts using compact arrays [posX, posY, posZ, sizeX, sizeY, sizeZ, rotX, rotY, rotZ, paletteKey, shape?, transparency?]. Palette maps short keys to [BrickColor, Material] pairs. The build is saved and can be referenced by import_build or import_scene.',
    inputSchema: {
      type: 'object',
      properties: {
        id: {
          type: 'string',
          description: 'Build ID including style prefix (e.g. "medieval/torch_01", "nature/bush_small")'
        },
        style: {
          type: 'string',
          enum: ['medieval', 'modern', 'nature', 'scifi', 'misc'],
          description: 'Style category'
        },
        palette: {
          type: 'object',
          description: 'Map of short keys to [BrickColor, Material] or [BrickColor, Material, MaterialVariant] tuples. E.g. {"a": ["Dark stone grey", "Concrete"], "b": ["Brown", "Wood", "MyCustomWood"]}'
        },
        parts: {
          type: 'array',
          description: 'Array of parts. Object format: {position:[x,y,z], size:[x,y,z], rotation:[x,y,z], paletteKey, shape?, transparency?}. Tuple format [posX,posY,posZ,sizeX,sizeY,sizeZ,rotX,rotY,rotZ,paletteKey,shape?,transparency?] also accepted.',
          items: {
            anyOf: [
              {
                type: 'object',
                additionalProperties: false,
                required: ['position', 'size', 'rotation', 'paletteKey'],
                properties: {
                  position: { type: 'array', items: { type: 'number' }, minItems: 3, maxItems: 3 },
                  size: { type: 'array', items: { type: 'number' }, minItems: 3, maxItems: 3 },
                  rotation: { type: 'array', items: { type: 'number' }, minItems: 3, maxItems: 3 },
                  paletteKey: { type: 'string', minLength: 1 },
                  shape: { type: 'string', enum: ['Block', 'Wedge', 'Cylinder', 'Ball', 'CornerWedge'] },
                  transparency: { type: 'number', minimum: 0, maximum: 1 }
                }
              },
              {
                type: 'array',
                minItems: 10,
                items: { anyOf: [{ type: 'number' }, { type: 'string' }] }
              }
            ]
          }
        },
        bounds: {
          type: 'array',
          items: { type: 'number' },
          description: 'Optional bounding box [X, Y, Z]. Auto-computed if omitted.'
        }
      },
      required: ['id', 'style', 'palette', 'parts']
    }
  },
  {
    name: 'generate_build',
    category: 'write',
    description: `Procedurally generate a build via JS code. ALWAYS generate the entire scene in ONE call — never split into multiple small builds. PREFER high-level primitives over manual loops. No comments. No unnecessary variables. Maximize build detail per line.

EDITING: When modifying an existing build, call get_build first to retrieve the original code. Then make ONLY the targeted changes the user requested — do not rewrite unchanged code. Pass the modified code to generate_build.

HIGH-LEVEL (use these first — each replaces 5-20 lines):
  room(x,y,z, w,h,d, wallKey, floorKey?, ceilKey?, wallThickness?) - Complete enclosed room (floor+ceiling+4 walls)
  roof(x,y,z, w,d, style, key, overhang?) - style: "flat"|"gable"|"hip"
  stairs(x1,y1,z1, x2,y2,z2, width, key) - Auto-generates steps between two points
  column(x,y,z, height, radius, key, capKey?) - Cylinder with base+capital
  pew(x,y,z, w,d, seatKey, legKey?) - Bench with seat+backrest+legs
  arch(x,y,z, w,h, thickness, key, segments?) - Curved archway
  fence(x1,z1, x2,z2, y, key, postSpacing?) - Fence with posts+rails

BASIC:
  part(x,y,z, sx,sy,sz, key, shape?, transparency?)
  rpart(x,y,z, sx,sy,sz, rx,ry,rz, key, shape?, transparency?)
  wall(x1,z1, x2,z2, height, thickness, key) — vertical plane from (x1,z1) to (x2,z2)
  floor(x1,z1, x2,z2, y, thickness, key) — horizontal plane at height y, corners (x1,z1)-(x2,z2). NOT fill — only takes 2D corners+y, not 3D points
  fill(x1,y1,z1, x2,y2,z2, key, [ux,uy,uz]?) — 3D volume between two 3D points
  beam(x1,y1,z1, x2,y2,z2, thickness, key)

IMPORTANT: Palette keys must match exactly. Use only keys defined in your palette object, not color names.
CUSTOM MATERIALS: Use search_materials to find MaterialVariant names, then reference them as the 3rd palette element: {"a": ["Color", "BaseMaterial", "VariantName"]}.

REPETITION:
  row(x,y,z, count, spacingX, spacingZ, fn(i,cx,cy,cz))
  grid(x,y,z, countX, countZ, spacingX, spacingZ, fn(ix,iz,cx,cy,cz))

Shapes: Block(default), Wedge, Cylinder, Ball, CornerWedge. Max 10000 parts. Math and rng() available.
CYLINDER AXIS: Roblox cylinders extend along the X axis. For upright cylinders, use size (height, diameter, diameter) with rz=90. The column() primitive handles this automatically.

EXAMPLE — compact cabin (17 lines):
room(0,0,0,8,4,6,"a","b","a")
roof(0,4,0,8,6,"gable","c")
wall(-4,0,-2,4,0,-2,4,1,"a")
part(0,2,3,3,3,0.3,"a","Block",0.4)
row(-2,0,-1,3,0,2,(i,cx,cy,cz)=>{pew(cx,0,cz,3,2,"d")})
column(-3,0,-2,4,0.5,"a","b")
column(3,0,-2,4,0.5,"a","b")
part(0,2,0,2,1,1,"b")`,
    inputSchema: {
      type: 'object',
      properties: {
        id: {
          type: 'string',
          description: 'Build ID including style prefix (e.g. "medieval/church_01")'
        },
        style: {
          type: 'string',
          enum: ['medieval', 'modern', 'nature', 'scifi', 'misc'],
          description: 'Style category'
        },
        palette: {
          type: 'object',
          description: 'Map of short keys to [BrickColor, Material] or [BrickColor, Material, MaterialVariant] tuples. E.g. {"a": ["Dark stone grey", "Cobblestone"], "b": ["Brown", "WoodPlanks", "MyCustomWood"]}. MaterialVariant is optional — use it to reference custom materials from MaterialService.'
        },
        code: {
          type: 'string',
          description: 'JavaScript code using the primitives above to generate parts procedurally'
        },
        seed: {
          type: 'number',
          description: 'Optional seed for deterministic rng() output (default: 42)'
        }
      },
      required: ['id', 'style', 'palette', 'code']
    }
  },
  {
    name: 'import_build',
    category: 'write',
    description: 'Import a build into Roblox Studio. Accepts either a full build data object OR a library ID string (e.g. "medieval/church_01") to load from the build library. When using generate_build or create_build, pass the build ID string instead of the full data.',
    inputSchema: {
      type: 'object',
      properties: {
        buildData: {
          description: 'Either a build data object (with palette, parts, etc.) OR a library ID string (e.g. "medieval/church_01") to load from the build library'
        },
        targetPath: {
          type: 'string',
          description: 'Parent instance path where the model will be created'
        },
        position: {
          type: 'array',
          items: { type: 'number' },
          description: 'World position offset [X, Y, Z]'
        }
      },
      required: ['buildData', 'targetPath']
    }
  },
  {
    name: 'list_library',
    category: 'read',
    description: 'List available builds in the local build library. Returns build IDs, styles, bounds, and part counts. Optionally filter by style.',
    inputSchema: {
      type: 'object',
      properties: {
        style: {
          type: 'string',
          enum: ['medieval', 'modern', 'nature', 'scifi', 'misc'],
          description: 'Filter by style category'
        }
      }
    }
  },
  {
    name: 'search_materials',
    category: 'read',
    description: 'Search for MaterialVariant instances in MaterialService by name. Use this to find custom materials before using them in generate_build or create_build palettes. Returns material names and their base material types.',
    inputSchema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'Search query to match against material names (case-insensitive). Leave empty to list all.'
        },
        maxResults: {
          type: 'number',
          description: 'Max results to return (default: 50)'
        }
      }
    }
  },
  {
    name: 'get_build',
    category: 'read',
    description: 'Get a build from the library by ID. Returns metadata, palette, and generator code (if the build was created with generate_build). IMPORTANT: When the user asks to modify an existing build, ALWAYS call get_build first to retrieve the original code, then make targeted edits to only the relevant lines, and call generate_build with the modified code. Never rewrite the entire code from scratch — only change what the user asked to change.',
    inputSchema: {
      type: 'object',
      properties: {
        id: {
          type: 'string',
          description: 'Build ID (e.g. "medieval/church_01")'
        }
      },
      required: ['id']
    }
  },
  {
    name: 'import_scene',
    category: 'write',
    description: 'Import a full scene layout. Provide a scene with model references (resolved from library) and placement data. Each model is placed at the specified position/rotation. Can also include inline custom builds.',
    inputSchema: {
      type: 'object',
      properties: {
        sceneData: {
          type: 'object',
          description: 'Scene layout object with: models (map of key to library build ID), place (array of [key, position, rotation?]), and optional custom (array of inline build objects with name, position, palette, parts)',
          properties: {
            models: {
              type: 'object',
              description: 'Map of short keys to library build IDs (e.g. {"A": "medieval/cottage_01"})'
            },
            place: {
              type: 'array',
              description: 'Array of placements. Preferred format: {modelKey, position:[x,y,z], rotation?:[x,y,z]}. Legacy tuple format [modelKey, [x,y,z], [rotX?,rotY?,rotZ?]] is also accepted.',
              items: {
                anyOf: [
                  {
                    type: 'object',
                    additionalProperties: false,
                    required: ['modelKey', 'position'],
                    properties: {
                      modelKey: {
                        type: 'string'
                      },
                      position: {
                        type: 'array',
                        items: { type: 'number' }
                      },
                      rotation: {
                        type: 'array',
                        items: { type: 'number' }
                      }
                    }
                  },
                  {
                    type: 'array',
                    items: {
                      anyOf: [
                        {
                          type: 'string'
                        },
                        {
                          type: 'array',
                          items: { type: 'number' }
                        }
                      ]
                    }
                  }
                ]
              }
            },
            custom: {
              type: 'array',
              description: 'Array of inline custom builds with {n: name, o: [x,y,z], palette: {...}, parts: [...]}',
              items: { type: 'object' }
            }
          }
        },
        targetPath: {
          type: 'string',
          description: 'Parent instance path for the scene (default: game.Workspace)'
        }
      },
      required: ['sceneData']
    }
  },

  // === Asset Tools ===
  {
    name: 'search_assets',
    category: 'read',
    description: 'Search the Creator Store (Roblox marketplace) for assets by type and keywords. Requires ROBLOX_OPEN_CLOUD_API_KEY env var (no cookie auth for this endpoint).',
    inputSchema: {
      type: 'object',
      properties: {
        assetType: {
          type: 'string',
          enum: ['Audio', 'Model', 'Decal', 'Plugin', 'MeshPart', 'Video', 'FontFamily'],
          description: 'Type of asset to search for'
        },
        query: {
          type: 'string',
          description: 'Search keywords'
        },
        maxResults: {
          type: 'number',
          description: 'Max results to return (default: 25)'
        },
        sortBy: {
          type: 'string',
          enum: ['Relevance', 'Trending', 'Top', 'AudioDuration', 'CreateTime', 'UpdatedTime', 'Ratings'],
          description: 'Sort order (default: Relevance)'
        },
        verifiedCreatorsOnly: {
          type: 'boolean',
          description: 'Only show assets from verified creators (default: false)'
        }
      },
      required: ['assetType']
    }
  },
  {
    name: 'get_asset_details',
    category: 'read',
    description: 'Get detailed marketplace metadata for a specific asset. Uses ROBLOX_OPEN_CLOUD_API_KEY or falls back to ROBLOSECURITY cookie (own assets only).',
    inputSchema: {
      type: 'object',
      properties: {
        assetId: {
          type: 'number',
          description: 'The Roblox asset ID'
        }
      },
      required: ['assetId']
    }
  },
  {
    name: 'get_asset_thumbnail',
    category: 'read',
    description: 'Get the thumbnail image for an asset as base64 PNG, suitable for vision LLMs. Thumbnails API is public but asset validation uses ROBLOX_OPEN_CLOUD_API_KEY.',
    inputSchema: {
      type: 'object',
      properties: {
        assetId: {
          type: 'number',
          description: 'The Roblox asset ID'
        },
        size: {
          type: 'string',
          enum: ['150x150', '420x420', '768x432'],
          description: 'Thumbnail size (default: 420x420)'
        }
      },
      required: ['assetId']
    }
  },
  {
    name: 'insert_asset',
    category: 'write',
    description: 'Insert a Roblox asset into Studio by loading it via AssetService and parenting it to a target location. Optionally set position.',
    inputSchema: {
      type: 'object',
      properties: {
        assetId: {
          type: 'number',
          description: 'The Roblox asset ID to insert'
        },
        parentPath: {
          type: 'string',
          description: 'Parent instance path (default: game.Workspace)'
        },
        position: {
          type: 'object',
          properties: {
            x: { type: 'number' },
            y: { type: 'number' },
            z: { type: 'number' }
          },
          description: 'Optional world position to place the asset'
        }
      },
      required: ['assetId']
    }
  },
  {
    name: 'preview_asset',
    category: 'read',
    description: 'Preview a Roblox asset without permanently inserting it. Loads the asset, builds a hierarchy tree with properties and summary stats, then destroys it. Useful for inspecting asset contents before insertion.',
    inputSchema: {
      type: 'object',
      properties: {
        assetId: {
          type: 'number',
          description: 'The Roblox asset ID to preview'
        },
        includeProperties: {
          type: 'boolean',
          description: 'Include detailed properties for each instance (default: true)'
        },
        maxDepth: {
          type: 'number',
          description: 'Max hierarchy traversal depth (default: 10)'
        }
      },
      required: ['assetId']
    }
  },
  {
    name: 'place_check',
    category: 'read',
    description: 'Compare the live published place against the scripts currently open in Studio, without changing anything. Downloads the published .rbxl (needs ROBLOSECURITY) and reports, per script, whether the live copy is identical, differs, or is missing. Use before place_publish to see exactly what would go out.',
    inputSchema: {
      type: 'object',
      properties: {
        universeId: { type: 'number', description: 'Universe ID that owns the place' },
        placeId: { type: 'number', description: 'Place ID to compare against' },
        scriptPaths: {
          type: 'array',
          items: { type: 'string' },
          description: 'Script instance paths to compare, e.g. "ReplicatedStorage.Modules.Stage". A leading "game." is optional.'
        }
      },
      required: ['universeId', 'placeId', 'scriptPaths']
    }
  },
  {
    name: 'place_publish',
    category: 'write',
    description: 'Publish specific script edits from Studio to a live place WITHOUT pushing the rest of the open file. Downloads the published .rbxl, replaces only the named scripts\' Source, verifies no other script changed, publishes via Open Cloud (needs ROBLOX_OPEN_CLOUD_API_KEY with universe-places:write), then re-downloads to confirm the new source is live. Refuses to publish if a script is missing, if a path is held by more than one instance, or if patching would alter anything not requested. Use when the Studio file is a different place (e.g. a test place) than the target.',
    inputSchema: {
      type: 'object',
      properties: {
        universeId: { type: 'number', description: 'Universe ID that owns the place' },
        placeId: { type: 'number', description: 'Place ID to publish to' },
        scriptPaths: {
          type: 'array',
          items: { type: 'string' },
          description: 'Script instance paths whose Studio source should be published'
        },
        restartServers: {
          type: 'boolean',
          description: 'Restart running servers for this place only, so players get the new version (default false)'
        }
      },
      required: ['universeId', 'placeId', 'scriptPaths']
    }
  },
  {
    name: 'upload_asset',
    category: 'write',
    description: 'Upload any supported asset type to Roblox: Audio (mp3/ogg/wav/flac), Decal (png/jpg/bmp/tga), Model (fbx/gltf/glb/rbxm/rbxmx), Animation (rbxm/rbxmx), or Video (mp4/mov). Decal supports ROBLOSECURITY cookie auth or ROBLOX_OPEN_CLOUD_API_KEY. All other types require Open Cloud API key with asset:write scope + creator ID. Audio: max 7 min, 100 uploads/month (ID-verified). Video: max 5 min, requires 13+ ID-verified.',
    inputSchema: {
      type: 'object',
      properties: {
        filePath: {
          type: 'string',
          description: 'Absolute path to the file on disk'
        },
        assetType: {
          type: 'string',
          enum: ['Audio', 'Decal', 'Model', 'Animation', 'Video'],
          description: 'Type of asset to upload. Must match the file format.'
        },
        displayName: {
          type: 'string',
          description: 'Display name for the asset (max 50 characters)'
        },
        description: {
          type: 'string',
          description: 'Description for the asset (default: empty string)'
        },
        userId: {
          type: 'string',
          description: 'Roblox user ID for the asset creator. Overrides ROBLOX_CREATOR_USER_ID env var.'
        },
        groupId: {
          type: 'string',
          description: 'Roblox group ID for the asset creator. Overrides ROBLOX_CREATOR_GROUP_ID env var. Takes precedence over userId if both provided.'
        }
      },
      required: ['filePath', 'assetType', 'displayName']
    }
  },
  {
    name: 'capture_screenshot',
    category: 'read',
    description: 'Capture a screenshot of the Roblox Studio viewport and return it as a PNG image. Requires EditableImage API to be enabled: Game Settings > Security > "Allow Mesh / Image APIs". Only works in Edit mode with the viewport visible.',
    inputSchema: {
      type: 'object',
      properties: {},
    }
  },

  // === Input Simulation ===
  {
    name: 'simulate_mouse_input',
    category: 'write',
    description: 'Simulate mouse input in the Roblox Studio viewport via VirtualInputManager. Use during playtest to click UI buttons, interact with objects, or navigate menus. Coordinates are viewport pixels (top-left is 0,0). Use capture_screenshot to identify UI element positions before clicking.',
    inputSchema: {
      type: 'object',
      properties: {
        action: {
          type: 'string',
          enum: ['click', 'mouseDown', 'mouseUp', 'move', 'scroll'],
          description: 'Mouse action to perform. "click" does mouseDown + short delay + mouseUp.'
        },
        x: {
          type: 'number',
          description: 'Viewport pixel X coordinate'
        },
        y: {
          type: 'number',
          description: 'Viewport pixel Y coordinate'
        },
        button: {
          type: 'string',
          enum: ['Left', 'Right', 'Middle'],
          description: 'Mouse button (default: Left)'
        },
        scrollDirection: {
          type: 'string',
          enum: ['up', 'down'],
          description: 'Scroll direction (only for "scroll" action)'
        },
        target: {
          type: 'string',
          description: 'Instance target: "edit" (default), "server", "client-1", "client-2", etc.'
        }
      },
      required: ['action', 'x', 'y']
    }
  },
  {
    name: 'simulate_keyboard_input',
    category: 'write',
    description: 'Simulate keyboard input via VirtualInputManager. Use during playtest for character movement (W/A/S/D), jumping (Space), interactions (E), or any key-driven action. For sustained movement, use "press" to hold and "release" to let go.',
    inputSchema: {
      type: 'object',
      properties: {
        keyCode: {
          type: 'string',
          description: 'Enum.KeyCode name: "W", "A", "S", "D", "Space", "E", "F", "LeftShift", "LeftControl", "Return", "Tab", "Escape", "One", "Two", etc.'
        },
        action: {
          type: 'string',
          enum: ['press', 'release', 'tap'],
          description: '"tap" (default) = press + wait + release. "press" = key down only. "release" = key up only.'
        },
        duration: {
          type: 'number',
          description: 'Hold duration in seconds for "tap" action (default: 0.1). Use longer values for sustained input like walking.'
        },
        target: {
          type: 'string',
          description: 'Instance target: "edit" (default), "server", "client-1", "client-2", etc.'
        }
      },
      required: ['keyCode']
    }
  },

  // === Character Navigation ===
  {
    name: 'character_navigation',
    category: 'write',
    description: 'Move the player character to a target position or instance during playtest. Uses PathfindingService for automatic navigation around obstacles, falling back to direct movement. Requires an active playtest in "play" mode. Does NOT simulate player input — moves the character directly.',
    inputSchema: {
      type: 'object',
      properties: {
        position: {
          type: 'array',
          items: { type: 'number' },
          description: 'Target world position [x, y, z]. Either this or instancePath is required.'
        },
        instancePath: {
          type: 'string',
          description: 'Instance to navigate to (dot notation). The character walks to its Position. Either this or position is required.'
        },
        waitForCompletion: {
          type: 'boolean',
          description: 'Wait for the character to arrive before returning (default: true)'
        },
        timeout: {
          type: 'number',
          description: 'Max seconds to wait for navigation to complete (default: 25)'
        },
        target: {
          type: 'string',
          description: 'Instance target: "edit" (default), "server", "client-1", "client-2", etc.'
        }
      }
    }
  },

  // === Instance Operations ===
  {
    name: 'clone_object',
    category: 'write',
    description: 'Clone an instance to a new parent location. Creates a deep copy of the instance and all its descendants.',
    inputSchema: {
      type: 'object',
      properties: {
        instancePath: {
          type: 'string',
          description: 'Path of the instance to clone'
        },
        targetParentPath: {
          type: 'string',
          description: 'Path of the parent to place the clone under'
        }
      },
      required: ['instancePath', 'targetParentPath']
    }
  },
  // === Descendants & Comparison ===
  {
    name: 'get_descendants',
    category: 'read',
    description: 'Get all descendants of an instance recursively with depth info. More efficient than repeated get_instance_children calls.',
    inputSchema: {
      type: 'object',
      properties: {
        instancePath: {
          type: 'string',
          description: 'Root instance path'
        },
        maxDepth: {
          type: 'number',
          description: 'Maximum recursion depth (default: 10)'
        },
        classFilter: {
          type: 'string',
          description: 'Only include instances of this class (uses IsA, so "BasePart" matches Part, MeshPart, etc.)'
        }
      },
      required: ['instancePath']
    }
  },
  {
    name: 'compare_instances',
    category: 'read',
    description: 'Diff two instances by comparing their properties. Useful for debugging why a duplicate behaves differently.',
    inputSchema: {
      type: 'object',
      properties: {
        instancePathA: {
          type: 'string',
          description: 'First instance path'
        },
        instancePathB: {
          type: 'string',
          description: 'Second instance path'
        }
      },
      required: ['instancePathA', 'instancePathB']
    }
  },

  // === Output & Diagnostics ===
  {
    name: 'get_output_log',
    category: 'read',
    description: 'Get the Studio output log history. Works in both edit and play mode.',
    inputSchema: {
      type: 'object',
      properties: {
        maxEntries: {
          type: 'number',
          description: 'Maximum number of log entries to return (default: 100)'
        },
        messageType: {
          type: 'string',
          description: 'Filter by message type (e.g. "Enum.MessageType.MessageOutput", "Enum.MessageType.MessageWarning", "Enum.MessageType.MessageError")'
        }
      }
    }
  },
  // === Bulk Attributes ===
  {
    name: 'bulk_set_attributes',
    category: 'write',
    description: 'Set multiple attributes on an instance in a single call. More efficient than repeated set_attribute calls.',
    inputSchema: {
      type: 'object',
      properties: {
        instancePath: {
          type: 'string',
          description: 'Instance path'
        },
        attributes: {
          type: 'object',
          description: 'Map of attribute names to values. Supports Vector3, Color3, UDim2 via _type convention.'
        }
      },
      required: ['instancePath', 'attributes']
    }
  },

  // === Find and Replace ===
  {
    name: 'find_and_replace_in_scripts',
    category: 'write',
    description: 'Find and replace text across all scripts in the game. Supports literal and Lua pattern matching. Use dryRun to preview changes before applying. Pairs with grep_scripts for search-only operations.',
    inputSchema: {
      type: 'object',
      properties: {
        pattern: {
          type: 'string',
          description: 'Text or Lua pattern to find'
        },
        replacement: {
          type: 'string',
          description: 'Replacement text. When usePattern is true, supports Lua captures (%1, %2, etc.).'
        },
        caseSensitive: {
          type: 'boolean',
          description: 'Case-sensitive matching (default: false). Must be true when usePattern is true.'
        },
        usePattern: {
          type: 'boolean',
          description: 'Use Lua pattern matching instead of literal (default: false). Requires caseSensitive: true.'
        },
        path: {
          type: 'string',
          description: 'Limit scope to a subtree (e.g. "game.ServerScriptService")'
        },
        classFilter: {
          type: 'string',
          enum: ['Script', 'LocalScript', 'ModuleScript'],
          description: 'Only search scripts of this class type'
        },
        dryRun: {
          type: 'boolean',
          description: 'Preview changes without applying them (default: false)'
        },
        maxReplacements: {
          type: 'number',
          description: 'Safety limit on total replacements (default: 1000)'
        }
      },
      required: ['pattern', 'replacement']
    }
  },

  // ============================================================
  // Extended toolset (6xvl/robloxstudio-mcp plugin v1.1+)
  // ============================================================

  // === Health / Diagnostics ===
  {
    name: 'get_handler_health',
    category: 'read',
    description: 'Plugin handler health: idle/running times, slow endpoints, current operation, memory usage. Diagnose hangs.',
    inputSchema: { type: 'object', properties: {} }
  },

  // === Terrain ===
  {
    name: 'terrain_fill_block',
    category: 'write',
    description: 'Fill a rectangular block of terrain at a given CFrame, size, and material.',
    inputSchema: {
      type: 'object',
      properties: {
        cframe: { type: 'object', description: '{ x, y, z } position, or { cf: [12 floats] } full CFrame' },
        size: { type: 'object', description: '{ x, y, z } block size in studs' },
        material: { type: 'string', description: 'Enum.Material name (e.g. Grass, Rock, Sand)' }
      },
      required: ['cframe', 'size']
    }
  },
  {
    name: 'terrain_fill_ball',
    category: 'write',
    description: 'Fill a spherical region of terrain.',
    inputSchema: {
      type: 'object',
      properties: {
        center: { type: 'object', description: '{ x, y, z } center position' },
        radius: { type: 'number' },
        material: { type: 'string' }
      },
      required: ['center', 'radius']
    }
  },
  {
    name: 'terrain_fill_wedge',
    category: 'write',
    description: 'Fill a wedge-shaped region of terrain.',
    inputSchema: {
      type: 'object',
      properties: {
        cframe: { type: 'object' },
        size: { type: 'object' },
        material: { type: 'string' }
      },
      required: ['cframe', 'size']
    }
  },
  {
    name: 'terrain_fill_cylinder',
    category: 'write',
    description: 'Fill a cylindrical region of terrain.',
    inputSchema: {
      type: 'object',
      properties: {
        cframe: { type: 'object' },
        height: { type: 'number' },
        radius: { type: 'number' },
        material: { type: 'string' }
      },
      required: ['cframe', 'height', 'radius']
    }
  },
  {
    name: 'terrain_clear',
    category: 'write',
    description: 'Clear ALL terrain voxels in the place. Destructive.',
    inputSchema: { type: 'object', properties: {} }
  },
  {
    name: 'terrain_get_materials',
    category: 'read',
    description: 'List all Enum.Material names usable for terrain operations.',
    inputSchema: { type: 'object', properties: {} }
  },
  {
    name: 'terrain_read_voxels',
    category: 'read',
    description: 'Read a Region3 of terrain voxels and return material + occupancy grid info.',
    inputSchema: {
      type: 'object',
      properties: {
        min: { type: 'object', description: '{ x, y, z } min corner' },
        max: { type: 'object', description: '{ x, y, z } max corner' }
      },
      required: ['min', 'max']
    }
  },

  // === Lighting ===
  {
    name: 'lighting_list_presets',
    category: 'read',
    description: 'List available Lighting presets (day, dusk, night, horror, studio).',
    inputSchema: { type: 'object', properties: {} }
  },
  {
    name: 'lighting_set_preset',
    category: 'write',
    description: 'Apply an atomic Lighting preset by name (day | dusk | night | horror | studio).',
    inputSchema: {
      type: 'object',
      properties: { preset: { type: 'string' } },
      required: ['preset']
    }
  },
  {
    name: 'lighting_get',
    category: 'read',
    description: 'Read current Lighting service state + child post-effects.',
    inputSchema: { type: 'object', properties: {} }
  },
  {
    name: 'lighting_set',
    category: 'write',
    description: 'Set arbitrary Lighting properties in one atomic call. Pass { properties: { Brightness: 2, Ambient: {r,g,b}, ... } }.',
    inputSchema: {
      type: 'object',
      properties: { properties: { type: 'object' } },
      required: ['properties']
    }
  },

  // === Compare / Diff (compare_instances upstream) ===
  {
    name: 'diff_subtree',
    category: 'read',
    description: 'Snapshot two subtrees up to maxDepth and return both for client-side diffing.',
    inputSchema: {
      type: 'object',
      properties: {
        pathA: { type: 'string' },
        pathB: { type: 'string' },
        maxDepth: { type: 'number', description: 'Default 3' }
      },
      required: ['pathA', 'pathB']
    }
  },

  // === Animation ===
  {
    name: 'animation_play',
    category: 'write',
    description: 'Play an animation asset on a Humanoid/AnimationController target. Returns trackId for stop().',
    inputSchema: {
      type: 'object',
      properties: {
        targetPath: { type: 'string' },
        assetId: { type: 'string', description: 'rbxassetid:// URL' },
        fadeTime: { type: 'number' },
        weight: { type: 'number' },
        speed: { type: 'number' }
      },
      required: ['targetPath', 'assetId']
    }
  },
  {
    name: 'animation_stop',
    category: 'write',
    description: 'Stop a playing track by trackId.',
    inputSchema: {
      type: 'object',
      properties: {
        trackId: { type: 'string' },
        fadeTime: { type: 'number' }
      },
      required: ['trackId']
    }
  },
  {
    name: 'animation_list_tracks',
    category: 'read',
    description: 'List playing AnimationTracks on a target Humanoid/AnimationController.',
    inputSchema: {
      type: 'object',
      properties: { targetPath: { type: 'string' } },
      required: ['targetPath']
    }
  },
  {
    name: 'animation_load_keyframes',
    category: 'write',
    description: 'Build a KeyframeSequence from inline keyframe data and place it in the DataModel.',
    inputSchema: {
      type: 'object',
      properties: {
        parentPath: { type: 'string' },
        name: { type: 'string' },
        keyframes: { type: 'array', items: { type: 'object' }, description: '[{ time, poses: [{ name, cframe:{x,y,z}, weight }] }, ...]' }
      },
      required: ['keyframes']
    }
  },

  // === Particles ===
  {
    name: 'particle_create',
    category: 'write',
    description: 'Create a ParticleEmitter with NumberSequence/ColorSequence/NumberRange properties in one atomic call.',
    inputSchema: {
      type: 'object',
      properties: {
        parentPath: { type: 'string' },
        name: { type: 'string' },
        properties: { type: 'object', description: '{ texture, rate, color, size, transparency, lifetime, speed, rotation, rotSpeed, acceleration, drag, spreadAngle, lightEmission, lightInfluence, enabled }' }
      },
      required: ['parentPath']
    }
  },
  {
    name: 'particle_tune',
    category: 'write',
    description: 'Update properties on an existing ParticleEmitter (same property shape as particle_create).',
    inputSchema: {
      type: 'object',
      properties: {
        emitterPath: { type: 'string' },
        properties: { type: 'object' }
      },
      required: ['emitterPath', 'properties']
    }
  },

  // === Sound ===
  {
    name: 'sound_play_preview',
    category: 'write',
    description: 'Play a Sound preview through SoundService. Auto-cleans after 60s. Returns soundId.',
    inputSchema: {
      type: 'object',
      properties: {
        assetId: { type: 'string' },
        volume: { type: 'number' },
        speed: { type: 'number' },
        looped: { type: 'boolean' }
      },
      required: ['assetId']
    }
  },
  {
    name: 'sound_stop_preview',
    category: 'write',
    description: 'Stop a preview sound by soundId.',
    inputSchema: {
      type: 'object',
      properties: { soundId: { type: 'string' } },
      required: ['soundId']
    }
  },
  {
    name: 'sound_load_from_assetid',
    category: 'write',
    description: 'Create a persistent Sound instance from an asset ID under a parent.',
    inputSchema: {
      type: 'object',
      properties: {
        parentPath: { type: 'string' },
        assetId: { type: 'string' },
        name: { type: 'string' },
        volume: { type: 'number' },
        looped: { type: 'boolean' }
      },
      required: ['assetId']
    }
  },
  {
    name: 'sound_set_eq',
    category: 'write',
    description: 'Set EqualizerSoundEffect (low/mid/high gain) on a Sound.',
    inputSchema: {
      type: 'object',
      properties: {
        soundPath: { type: 'string' },
        lowGain: { type: 'number' },
        midGain: { type: 'number' },
        highGain: { type: 'number' },
        enabled: { type: 'boolean' }
      },
      required: ['soundPath']
    }
  },
  {
    name: 'sound_set_reverb',
    category: 'write',
    description: 'Set ReverbSoundEffect properties on a Sound.',
    inputSchema: {
      type: 'object',
      properties: {
        soundPath: { type: 'string' },
        decayTime: { type: 'number' },
        density: { type: 'number' },
        diffusion: { type: 'number' },
        dryLevel: { type: 'number' },
        wetLevel: { type: 'number' },
        enabled: { type: 'boolean' }
      },
      required: ['soundPath']
    }
  },

  // === Tween ===
  {
    name: 'tween_preview',
    category: 'write',
    description: 'Run a TweenService tween on a target instance and observe in viewport (design-time tuning).',
    inputSchema: {
      type: 'object',
      properties: {
        targetPath: { type: 'string' },
        tweenInfo: { type: 'object', description: '{ time, style, direction, repeatCount, reverses, delay }' },
        goal: { type: 'object', description: 'Property goal table' }
      },
      required: ['targetPath', 'goal']
    }
  },

  // === TextChat ===
  {
    name: 'textchat_configure',
    category: 'write',
    description: 'Configure TextChatService — ChatVersion, default commands/channels, BubbleChatConfiguration, ChatWindowConfiguration.',
    inputSchema: {
      type: 'object',
      properties: {
        chatVersion: { type: 'string' },
        createDefaultCommands: { type: 'boolean' },
        createDefaultTextChannels: { type: 'boolean' },
        bubbleChat: { type: 'object' },
        chatWindow: { type: 'object' }
      }
    }
  },
  {
    name: 'textchat_create_command',
    category: 'write',
    description: 'Create a TextChatCommand under TextChatService.TextChatCommands.',
    inputSchema: {
      type: 'object',
      properties: {
        name: { type: 'string' },
        primaryAlias: { type: 'string' },
        secondaryAlias: { type: 'string' },
        autocompleteVisible: { type: 'boolean' },
        enabled: { type: 'boolean' }
      },
      required: ['name', 'primaryAlias']
    }
  },
  {
    name: 'textchat_list_channels',
    category: 'read',
    description: 'List TextChannels under TextChatService.',
    inputSchema: { type: 'object', properties: {} }
  },

  // === Material ===
  {
    name: 'material_list_variants',
    category: 'read',
    description: 'List all MaterialVariants in MaterialService.',
    inputSchema: { type: 'object', properties: {} }
  },
  {
    name: 'material_create_variant',
    category: 'write',
    description: 'Create a MaterialVariant in MaterialService with optional texture maps.',
    inputSchema: {
      type: 'object',
      properties: {
        name: { type: 'string' },
        baseMaterial: { type: 'string' },
        materialPattern: { type: 'string' },
        colorMap: { type: 'string' },
        normalMap: { type: 'string' },
        metalnessMap: { type: 'string' },
        roughnessMap: { type: 'string' },
        studsPerTile: { type: 'number' }
      },
      required: ['name', 'baseMaterial']
    }
  },
  {
    name: 'material_override_base',
    category: 'write',
    description: 'Override the active MaterialVariant for a base Enum.Material (e.g. set Grass to use a variant).',
    inputSchema: {
      type: 'object',
      properties: {
        material: { type: 'string', description: 'Base Enum.Material name (e.g. Grass)' },
        variantName: { type: 'string', description: 'Empty string clears override' }
      },
      required: ['material']
    }
  },

  // === Profiling ===
  {
    name: 'profile_start',
    category: 'write',
    description: 'Start a Stats-based capture loop. Samples heartbeat/physics/network/instance/memory periodically.',
    inputSchema: {
      type: 'object',
      properties: { intervalMs: { type: 'number', description: 'Default 100' } }
    }
  },
  {
    name: 'profile_stop',
    category: 'read',
    description: 'Stop active capture and return all samples + average FPS.',
    inputSchema: { type: 'object', properties: {} }
  },
  {
    name: 'profile_snapshot',
    category: 'read',
    description: 'One-shot Stats snapshot: FPS, heartbeat/physics ms, network kbps, instance count, memory by category.',
    inputSchema: { type: 'object', properties: {} }
  },

  // === Extras ===
  {
    name: 'humanoid_description_apply',
    category: 'write',
    description: 'Apply a HumanoidDescription to a Humanoid (avatar setup).',
    inputSchema: {
      type: 'object',
      properties: {
        targetPath: { type: 'string' },
        description: { type: 'object' }
      },
      required: ['targetPath', 'description']
    }
  },
  {
    name: 'attribute_schema_validate',
    category: 'read',
    description: 'Validate an instance\'s attributes against a schema { key: { type, required, min, max, oneOf } }.',
    inputSchema: {
      type: 'object',
      properties: {
        targetPath: { type: 'string' },
        schema: { type: 'object' }
      },
      required: ['targetPath', 'schema']
    }
  },
  {
    name: 'streamingenabled_audit',
    category: 'read',
    description: 'Audit Workspace StreamingEnabled config + every Model\'s ModelStreamingMode and LevelOfDetail.',
    inputSchema: { type: 'object', properties: {} }
  },
  {
    name: 'reparent_instance',
    category: 'write',
    description: 'Move an instance to a new parent in one call.',
    inputSchema: {
      type: 'object',
      properties: {
        sourcePath: { type: 'string' },
        destinationPath: { type: 'string' }
      },
      required: ['sourcePath', 'destinationPath']
    }
  },
  {
    name: 'insert_service',
    category: 'write',
    description: 'Insert/get a service by name via game:GetService.',
    inputSchema: {
      type: 'object',
      properties: { name: { type: 'string' } },
      required: ['name']
    }
  },
  {
    name: 'generate_mesh',
    category: 'write',
    description: 'AI mesh generation. NOT SUPPORTED in 3rd-party plugins — use Roblox built-in Studio MCP instead.',
    inputSchema: { type: 'object', properties: {} }
  },
  {
    name: 'generate_material',
    category: 'write',
    description: 'AI material generation. NOT SUPPORTED in 3rd-party plugins — use Roblox built-in Studio MCP.',
    inputSchema: { type: 'object', properties: {} }
  },
  {
    name: 'generate_procedural_model',
    category: 'write',
    description: 'AI procedural model generation. NOT SUPPORTED in 3rd-party plugins — use Roblox built-in Studio MCP.',
    inputSchema: { type: 'object', properties: {} }
  },
  {
    name: 'rojo_status',
    category: 'read',
    description: 'Rojo sync status. NOT SUPPORTED from plugin — run Rojo CLI separately.',
    inputSchema: { type: 'object', properties: {} }
  },
  {
    name: 'wally_list',
    category: 'read',
    description: 'Wally package list. NOT SUPPORTED from plugin — run Wally CLI separately.',
    inputSchema: { type: 'object', properties: {} }
  },
  {
    name: 'package_publish',
    category: 'write',
    description: 'Publish a package. NOT SUPPORTED from plugin — needs OpenCloud auth.',
    inputSchema: { type: 'object', properties: {} }
  },
  {
    name: 'physics_bake',
    category: 'write',
    description: 'Bake physics joints. NOT SUPPORTED from plugin — no Studio API exposed.',
    inputSchema: { type: 'object', properties: {} }
  },





  // === Studio process management (schema ported verbatim from Chrrxs/robloxstudio-mcp, MIT) ===
  {
    name: 'manage_instance',
    category: 'write',
    description: 'Use to manage Studio processes or list place revisions.',
    inputSchema: {
      type: 'object',
      properties: {
        action: {
          type: 'string',
          enum: ['launch', 'authorize', 'complete', 'close', 'status', 'list_place_versions'],
          description: 'Operation; authorize and complete only resume identity launches.'
        },
        source: {
          type: 'string',
          enum: ['baseplate', 'local_file', 'published_place', 'place_revision'],
          description: 'Launch source; local_file needs path, published needs place_id.'
        },
        local_place_file: {
          type: 'string',
          description: '.rbxl or .rbxlx path; required for local_file.'
        },
        place_id: {
          type: 'number',
          description: 'Place ID; required for published sources and version listing.'
        },
        place_version: {
          type: 'number',
          description: 'Revision number; required for place_revision.'
        },
        require_process_identity: {
          type: 'boolean',
          description: 'Require PID attestation and explicit authorization.'
        },
        wait_for_connection: {
          type: 'boolean',
          description: 'Wait for instance_id; false returns launch_id.'
        },
        timeout_ms: {
          type: 'number',
          description: 'Plugin timeout in ms; default 120000; ignored in identity mode.'
        },
        studio_executable: {
          type: 'string',
          description: 'Exact Studio executable for launch; otherwise auto-discovered.'
        },
        studio_working_directory: {
          type: 'string',
          description: 'Studio process working directory; isolates relative plugin folders per launch.'
        },
        process_environment: {
          type: 'object',
          description: 'Launch-only environment changes; never stored.',
          properties: {
            set: {
              type: 'object',
              description: 'Environment variables to set.',
              propertyNames: {
                pattern: '^[A-Za-z_][A-Za-z0-9_]*$'
              },
              additionalProperties: {
                type: 'string'
              }
            },
            remove: {
              type: 'array',
              description: 'Environment variables to remove.',
              items: {
                type: 'string',
                pattern: '^[A-Za-z_][A-Za-z0-9_]*$'
              }
            }
          },
          additionalProperties: false
        },
        max_page_size: {
          type: 'number',
          description: 'Versions per page; clamped to 1-50, default 10.'
        },
        page_token: {
          type: 'string',
          description: 'Prior list_place_versions page token.'
        },
        instance_id: {
          type: 'string',
          description: 'Connected instance for close or status; excludes launch_id.'
        },
        launch_id: {
          type: 'string',
          description: 'Launch for close or status; excludes instance_id.'
        }
      },
      required: ['action']
    }
  },

  // === Playtest control (schemas ported verbatim from Chrrxs/robloxstudio-mcp, MIT) ===
  {
    name: 'solo_playtest',
    category: 'write',
    description: 'Use to start, stop, or inspect a single-player Studio playtest.',
    inputSchema: {
      type: 'object',
      properties: {
        action: {
          type: 'string',
          enum: ['start', 'stop', 'status'],
          description: 'Lifecycle action to run.'
        },
        mode: {
          type: 'string',
          enum: ['play', 'run'],
          description: 'Required for action="start".'
        },
        timeout: {
          type: 'number',
          description: 'Wait in seconds; start defaults to 60 and stop to 15.'
        },
        instance_id: {
          type: 'string',
          description: 'Connected place ID; required with multiple places.'
        }
      },
      required: ['action']
    }
  },
  {
    name: 'multiplayer_playtest',
    category: 'write',
    description: 'Use to run or inspect a multi-client Studio playtest.',
    inputSchema: {
      type: 'object',
      properties: {
        action: {
          type: 'string',
          enum: ['start', 'status', 'add_players', 'leave_client', 'end'],
          description: 'Lifecycle action to run.'
        },
        numPlayers: {
          type: 'number',
          description: 'Client count for start or add_players; 1-8.'
        },
        target: {
          type: 'string',
          description: 'Client for leave_client; defaults to client-1.'
        },
        testArgs: {
          description: 'JSON value exposed through GetTestArgs on server and clients.'
        },
        value: {
          description: 'JSON value returned by end to the edit process.'
        },
        timeout: {
          type: 'number',
          description: 'Wait in seconds; defaults to 30.'
        },
        instance_id: {
          type: 'string',
          description: 'Connected place ID; required with multiple places.'
        }
      },
      required: ['action']
    }
  },

  // === Device and network simulation (schemas ported verbatim from Chrrxs/robloxstudio-mcp, MIT) ===
  {
    name: 'set_device_simulator',
    category: 'write',
    description: 'Use to manage device simulation in edit or a playtest client.',
    inputSchema: {
      type: 'object',
      properties: {
        target: {
          type: 'string',
          description: 'Edit, client-N, or all-clients; defaults to edit.'
        },
        deviceId: {
          type: 'string',
          description: 'Built-in device preset ID.'
        },
        orientation: {
          type: 'string',
          description: 'ScreenOrientation enum name.'
        },
        resolution: {
          type: 'object',
          additionalProperties: false,
          properties: {
            width: {
              type: 'number',
              description: 'Viewport width in pixels.'
            },
            height: {
              type: 'number',
              description: 'Viewport height in pixels.'
            }
          },
          required: ['width', 'height'],
          description: 'Resolution override after the preset.'
        },
        pixelDensity: {
          type: 'number',
          description: 'Positive density override after the preset.'
        },
        scalingMode: {
          type: 'string',
          description: 'DeviceSimulatorScalingMode enum name.'
        },
        stopSimulation: {
          type: 'boolean',
          description: 'Stop simulation; excludes other simulator settings.'
        },
        instance_id: {
          type: 'string',
          description: 'Connected place ID; required with multiple places.'
        }
      }
    }
  },
  {
    name: 'get_device_simulator_state',
    category: 'read',
    description: 'Use to inspect device simulation or list device presets.',
    inputSchema: {
      type: 'object',
      properties: {
        target: {
          type: 'string',
          description: 'Edit or client peer; defaults to edit. Servers are invalid.'
        },
        deviceId: {
          type: 'string',
          description: 'Built-in preset to inspect.'
        },
        includeDeviceList: {
          type: 'boolean',
          description: 'Include built-in presets; defaults to true.'
        },
        instance_id: {
          type: 'string',
          description: 'Connected place ID; required with multiple places.'
        }
      }
    }
  },
  {
    name: 'capture_device_matrix',
    category: 'write',
    description: 'Use to compare viewport screenshots across up to six device settings.',
    inputSchema: {
      type: 'object',
      properties: {
        entries: {
          type: 'array',
          maxItems: 6,
          description: 'Ordered device settings to capture.',
          items: {
            type: 'object',
            additionalProperties: false,
            properties: {
              label: {
                type: 'string',
                description: 'Screenshot metadata label.'
              },
              deviceId: {
                type: 'string',
                description: 'Built-in device preset ID.'
              },
              orientation: {
                type: 'string',
                description: 'ScreenOrientation enum name.'
              },
              resolution: {
                type: 'object',
                additionalProperties: false,
                description: 'Viewport override for this capture.',
                properties: {
                  width: {
                    type: 'number',
                    description: 'Viewport width in pixels.'
                  },
                  height: {
                    type: 'number',
                    description: 'Viewport height in pixels.'
                  }
                },
                required: ['width', 'height']
              },
              pixelDensity: {
                type: 'number',
                description: 'Positive density override.'
              },
              scalingMode: {
                type: 'string',
                description: 'DeviceSimulatorScalingMode enum name.'
              }
            }
          }
        },
        target: {
          type: 'string',
          description: 'Edit or one client-N; not server or all-clients.'
        },
        format: {
          type: 'string',
          enum: ['jpeg', 'png'],
          description: 'Image format; defaults to jpeg. png is lossless.'
        },
        quality: {
          type: 'number',
          description: 'JPEG quality 1-100; defaults to 92. Ignored for png.'
        },
        settleSeconds: {
          type: 'number',
          description: 'Delay per capture in seconds; defaults to 0.3.'
        },
        restoreAfter: {
          type: 'boolean',
          description: 'Restore a preset afterward; custom devices cannot be restored.'
        },
        instance_id: {
          type: 'string',
          description: 'Connected place ID; required with multiple places.'
        }
      },
      required: ['entries']
    }
  },
  {
    name: 'set_network_profile',
    category: 'write',
    description: 'Use to simulate client latency, jitter, or packet loss.',
    inputSchema: {
      type: 'object',
      properties: {
        profile: {
          type: 'string',
          enum: ['great', 'good', 'poor', 'custom'],
          description: 'Network preset; custom requires overrides.'
        },
        target: {
          type: 'string',
          description: 'Client peer or all-clients; defaults to client-1.'
        },
        overrides: {
          type: 'object',
          additionalProperties: false,
          properties: {
            InboundNetworkMinDelayMs: {
              type: 'number',
              minimum: 0,
              description: 'Server-to-client minimum delay in ms.'
            },
            OutboundNetworkMinDelayMs: {
              type: 'number',
              minimum: 0,
              description: 'Client-to-server minimum delay in ms.'
            },
            InboundNetworkJitterMs: {
              type: 'number',
              minimum: 0,
              description: 'Server-to-client jitter in ms.'
            },
            OutboundNetworkJitterMs: {
              type: 'number',
              minimum: 0,
              description: 'Client-to-server jitter in ms.'
            },
            InboundNetworkLossPercent: {
              type: 'number',
              minimum: 0,
              maximum: 0.5,
              description: 'Server-to-client packet loss percent.'
            },
            OutboundNetworkLossPercent: {
              type: 'number',
              minimum: 0,
              maximum: 0.5,
              description: 'Client-to-server packet loss percent.'
            }
          },
          description: 'NetworkSettings fields that override or define the profile.'
        },
        instance_id: {
          type: 'string',
          description: 'Connected place ID; required with multiple places.'
        }
      },
      required: ['profile']
    }
  },
  {
    name: 'get_simulation_state',
    category: 'read',
    description: 'Use to inspect current network and device simulation.',
    inputSchema: {
      type: 'object',
      properties: {
        include: {
          type: 'string',
          enum: ['network', 'deviceSimulator', 'both'],
          description: 'State group; defaults to both.'
        },
        target: {
          type: 'string',
          description: 'Edit or client scope; servers are invalid.'
        },
        instance_id: {
          type: 'string',
          description: 'Connected place ID; required with multiple places.'
        }
      }
    }
  },
  {
    name: 'reset_simulation_state',
    category: 'write',
    description: 'Use to clear network and device simulation state.',
    inputSchema: {
      type: 'object',
      properties: {
        target: {
          type: 'string',
          description: 'Edit or client scope; servers are invalid.'
        },
        network: {
          type: 'boolean',
          description: 'Reset network simulation; defaults to true.'
        },
        deviceSimulator: {
          type: 'boolean',
          description: 'Stop device simulation; defaults to true.'
        },
        instance_id: {
          type: 'string',
          description: 'Connected place ID; required with multiple places.'
        }
      }
    }
  },

  // === Profiling, memory and breakpoints (schemas ported verbatim from Chrrxs/robloxstudio-mcp, MIT, so they match the handlers) ===
  {
    name: 'capture_script_profiler',
    category: 'read',
    description: 'Use to find Luau CPU hotspots on a running server or client.',
    inputSchema: {
      type: 'object',
      properties: {
        target: {
          type: 'string',
          pattern: '^(server|client-[0-9]+)$',
          description: 'Running server or client-N; edit is invalid.'
        },
        duration_ms: {
          type: 'number',
          default: 1000,
          minimum: 100,
          maximum: 15000,
          description: 'Capture length in ms.'
        },
        frequency: {
          type: 'number',
          default: 1000,
          minimum: 1,
          maximum: 10000,
          description: 'Samples per second.'
        },
        max_functions: {
          type: 'number',
          default: 20,
          minimum: 1,
          maximum: 100,
          description: 'Returned function and debug-label limit.'
        },
        min_total_us: {
          type: 'number',
          default: 0,
          minimum: 0,
          description: 'Minimum function TotalDuration in microseconds.'
        },
        filter: {
          type: 'string',
          description: 'Case-insensitive function name or source substring.'
        },
        include_native: {
          type: 'boolean',
          description: 'Include native frames; defaults to false.'
        },
        include_plugin: {
          type: 'boolean',
          description: 'Include plugin frames; defaults to false.'
        },
        output_path: {
          type: 'string',
          description: 'Raw JSON file; the response returns only its path.'
        },
        instance_id: {
          type: 'string',
          description: 'Connected place ID; required with multiple places.'
        }
      }
    }
  },
  {
    name: 'capture_micro_profiler',
    category: 'read',
    description: 'Use to profile engine and game frame time on a live peer.',
    inputSchema: {
      type: 'object',
      properties: {
        target: {
          type: 'string',
          pattern: '^(server|client-[0-9]+)$',
          description: 'Running server or client-N; edit is invalid.'
        },
        duration_ms: {
          type: 'number',
          default: 1000,
          minimum: 100,
          maximum: 5000,
          description: 'Capture length in ms.'
        },
        focus: {
          type: 'string',
          enum: ['all', 'script', 'physics', 'render', 'network', 'jobs'],
          default: 'all',
          description: 'Subsystem filter.'
        },
        filter: {
          type: 'string',
          description: 'Case-insensitive timer or group substring.'
        },
        max_timers: {
          type: 'number',
          default: 20,
          minimum: 1,
          maximum: 100,
          description: 'Returned timer limit.'
        },
        max_groups: {
          type: 'number',
          default: 20,
          minimum: 1,
          maximum: 100,
          description: 'Returned group limit; each group includes hot timers.'
        },
        max_timers_per_group: {
          type: 'number',
          default: 5,
          minimum: 0,
          maximum: 20,
          description: 'Nested timers per group; 0 omits them.'
        },
        max_related_timers: {
          type: 'number',
          default: 3,
          minimum: 0,
          maximum: 10,
          description: 'Parent, child, and thread rows per timer; 0 omits them.'
        },
        min_total_us: {
          type: 'number',
          default: 0,
          minimum: 0,
          description: 'Minimum inclusive_us after other filters.'
        },
        include_idle: {
          type: 'boolean',
          description: 'Include idle timers; defaults to false.'
        },
        include_gpu: {
          type: 'boolean',
          description: 'Include GPU events; defaults to false.'
        },
        max_events: {
          type: 'number',
          default: 250000,
          minimum: 10000,
          maximum: 1000000,
          description: 'LibMP event inspection limit.'
        },
        frame_window: {
          type: 'number',
          default: 240,
          minimum: 1,
          maximum: 2000,
          description: 'Trailing frames to analyze.'
        },
        output_path: {
          type: 'string',
          description: 'Raw snapshot file; the response stays summarized.'
        },
        summary_output_path: {
          type: 'string',
          description: 'Summary JSON file with its comparison index.'
        },
        baseline_path: {
          type: 'string',
          description: 'Summary file used as the baseline.'
        },
        baseline: {
          type: 'object',
          description: 'Inline summary used as the baseline.'
        },
        baseline_label: {
          type: 'string',
          description: 'Baseline comparison label.'
        },
        current_label: {
          type: 'string',
          description: 'Current comparison label.'
        },
        max_comparison_rows: {
          type: 'number',
          default: 20,
          minimum: 1,
          maximum: 100,
          description: 'Rows returned per comparison section.'
        },
        include_comparison_index: {
          type: 'boolean',
          description: 'Return the full comparison index; defaults to false.'
        },
        instance_id: {
          type: 'string',
          description: 'Connected place ID; required with multiple places.'
        }
      }
    }
  },
  {
    name: 'get_memory_breakdown',
    category: 'read',
    description: 'Use to compare memory categories across Studio peers.',
    inputSchema: {
      type: 'object',
      properties: {
        target: {
          type: 'string',
          description: 'Edit, server, client-N, or all; defaults to all.'
        },
        tags: {
          type: 'array',
          items: { type: 'string' },
          description: 'DeveloperMemoryTag filter; unknown tags return zero.'
        },
        instance_id: {
          type: 'string',
          description: 'Connected place ID; required with multiple places.'
        }
      }
    }
  },
  {
    name: 'get_scene_analysis',
    category: 'read',
    description: 'Use to attribute scene cost across instances and content.',
    inputSchema: {
      type: 'object',
      properties: {
        mode: {
          type: 'string',
          enum: ['all', 'instance_composition', 'script_memory', 'unparented_instances', 'triangle_composition', 'animation_memory', 'audio_memory'],
          description: 'Analysis mode; defaults to all.'
        },
        target: {
          type: 'string',
          description: 'Edit, server, client-N, or all; defaults to all.'
        },
        topN: {
          type: 'number',
          minimum: 1,
          maximum: 100,
          description: 'Flattened entries per mode; defaults to 10.'
        },
        raw: {
          type: 'boolean',
          description: 'Include full nested result trees; defaults to false.'
        },
        instance_id: {
          type: 'string',
          description: 'Connected place ID; required with multiple places.'
        }
      }
    }
  },
  {
    name: 'breakpoints',
    category: 'write',
    description: 'Use to trace script execution with breakpoints or logpoints.',
    inputSchema: {
      type: 'object',
      properties: {
        action: {
          type: 'string',
          enum: ['set', 'remove', 'clear', 'list'],
          description: 'Operation; set/remove need location; clear targets MCP entries.'
        },
        clear_all: {
          type: 'boolean',
          description: 'With clear, also remove user-created breakpoints.'
        },
        script_path: {
          type: 'string',
          description: 'Script path; required for set and remove.'
        },
        line: {
          type: 'number',
          description: '1-based line for set or remove.'
        },
        enabled: {
          type: 'boolean',
          description: 'Initial enabled state; defaults to true.'
        },
        condition: {
          type: 'string',
          description: 'Luau condition for set.'
        },
        log_message: {
          type: 'string',
          description: 'Luau expressions to log; quote literal text.'
        },
        continue_execution: {
          type: 'boolean',
          description: 'Continue after hit; defaults true; false needs a resumer.'
        },
        target: {
          type: 'string',
          description: 'Edit, server, or client-N; defaults to edit.'
        },
        instance_id: {
          type: 'string',
          description: 'Connected place ID; required with multiple places.'
        }
      },
      required: ['action']
    }
  },

  // === Selection and .rbxm round-trip ===
  {
    name: 'selection',
    category: 'write',
    description: 'Get, set, add to, remove from, or frame the Studio selection.',
    inputSchema: {
      type: 'object',
      properties: {
        action: { type: 'string', enum: ['get', 'set', 'add', 'remove', 'frame'], description: 'Defaults to get.' },
        paths: { type: 'array', items: { type: 'string' }, description: 'Instance paths for set/add/remove. Empty array with set clears.' },
        path: { type: 'string', description: 'Instance to frame; required for frame.' },
        padding: { type: 'number', description: 'Frame distance multiplier, 0 to 10. Defaults to 1.' },
        from: { type: 'number', description: 'Compass angle in degrees to view from.' },
        angleY: { type: 'number', description: 'Elevation in degrees, -89 to 89.' }
      }
    }
  },
  {
    name: 'export_rbxm',
    category: 'read',
    description: 'Save instances as a real .rbxm via SerializationService — lossless, unlike export_build\'s compact JSON. target may be "server" to lift a model out of a running game.',
    inputSchema: {
      type: 'object',
      properties: {
        instance_paths: { type: 'array', items: { type: 'string' }, description: 'Instances to serialize.' },
        output_path: { type: 'string', description: 'Local file to write.' },
        target: { type: 'string', enum: ['edit', 'server'], description: 'Which peer to read from; defaults to edit.' }
      },
      required: ['instance_paths', 'output_path']
    }
  },
  {
    name: 'import_rbxm',
    category: 'write',
    description: 'Load a .rbxm from a local path, an http(s) URL, or inline base64, under a chosen parent. Parenting is all-or-nothing.',
    inputSchema: {
      type: 'object',
      properties: {
        source: {
          type: 'object',
          properties: {
            path: { type: 'string', description: 'Local .rbxm file.' },
            url: { type: 'string', description: 'http(s) URL, 50 MiB cap.' },
            base64: { type: 'string', description: 'Inline rbxm bytes.' }
          },
          description: 'Exactly one of path, url, base64.'
        },
        parent_path: { type: 'string', description: 'Instance to parent the loaded instances under.' },
        target: { type: 'string', enum: ['edit', 'server'], description: 'Which peer to load into; defaults to edit.' }
      },
      required: ['source', 'parent_path']
    }
  },
  {
    name: 'generate_model',
    category: 'write',
    description: 'Stage a Roblox model from a text prompt or an image, via GenerationService.',
    inputSchema: {
      type: 'object',
      properties: {
        prompt: { type: 'string', description: 'Text description of the model.' },
        assetId: { type: 'number', description: 'Image asset id to generate from instead of a prompt.' },
        name: { type: 'string', description: 'Name for the staged model.' }
      }
    }
  },

  // === Live VM evaluation (needs a running playtest) ===
  {
    name: 'eval_server_runtime',
    category: 'write',
    description: 'Run Luau in the live SERVER VM, sharing its require cache. Unlike execute_luau (plugin VM, fresh module copies), this sees the running game\'s mutated module state. Needs a playtest.',
    inputSchema: {
      type: 'object',
      properties: {
        code: { type: 'string', description: 'Luau; return a value to include it in the result.' }
      },
      required: ['code']
    }
  },
  {
    name: 'eval_client_runtime',
    category: 'write',
    description: 'Run Luau in a live CLIENT VM, sharing its require cache. Needs a playtest.',
    inputSchema: {
      type: 'object',
      properties: {
        code: { type: 'string', description: 'Luau; return a value to include it in the result.' },
        target: { type: 'string', description: 'Client peer, e.g. client-1. Defaults to client-1.' }
      },
      required: ['code']
    }
  },
  {
    name: 'get_runtime_logs',
    category: 'read',
    description: 'Read recent output PER PEER (edit, server, client-N, or all). A value that differs between server and client is the shape of every replication bug, and a merged log cannot show which side printed it.',
    inputSchema: {
      type: 'object',
      properties: {
        target: { type: 'string', description: 'edit, server, client-N, or all. Defaults to all.' },
        since: { type: 'number', description: 'Sequence cursor; pass back nextSince from the previous read.' },
        tail: { type: 'number', description: 'Last N entries after filtering.' },
        filter: { type: 'string', description: 'Literal message substring, applied before tail.' }
      }
    }
  },

  // === Reference documentation (no Studio connection needed) ===
  {
    name: 'get_roblox_docs',
    category: 'read',
    description: 'Read the official Roblox engine or Luau reference for one name. Answers with no Studio open.',
    inputSchema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Exact reference name, case-sensitive (e.g. "ProximityPrompt", "TweenInfo").' },
        doc_type: {
          type: 'string',
          enum: ['classes', 'enums', 'datatypes', 'libraries', 'globals'],
          description: 'Reference category; defaults to classes.'
        },
        section: { type: 'string', description: 'Return only this level-two heading (e.g. "Properties"). Large pages list their sections.' }
      },
      required: ['name']
    }
  },
  {
    name: 'get_roblox_skills',
    category: 'read',
    description: 'List or read the skill documents shipped in the installed Studio Assistant bundle.',
    inputSchema: {
      type: 'object',
      properties: {
        action: { type: 'string', enum: ['list', 'get'], description: 'List every skill, or get one document.' },
        name: { type: 'string', description: 'Skill name from action="list"; required for get.' }
      },
      required: ['action']
    }
  },
];

export const getReadOnlyTools = () => TOOL_DEFINITIONS.filter(t => t.category === 'read');
export const getAllTools = () => [...TOOL_DEFINITIONS];
