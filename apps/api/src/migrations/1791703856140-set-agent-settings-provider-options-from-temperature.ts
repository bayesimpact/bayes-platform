import type { MigrationInterface, QueryRunner } from "typeorm"

/**
 when different from gemini 3.x => set only temp
 when gemini 3.x =>
    - 'gemini-3.1-flash-lite' and 'gemini-3.5-flash' => set temp + thinking level (temp is NOT deprecated for these models)
    - others => set only thinking level

     table for approximative and arbitrary conversion from temp to thinking level:
     MINIMAL : 0 <= temp <= 0.3 (*)
     LOW : 0.3 < temp <= 0.7
     MEDIUM : 0.7 < temp <= 1.3
     HIGH : 1.3 < temp <= 2.0

    (*) : if MINIMAL not available for model => LOW
 */
export class SetAgentSettingsProviderOptionsFromTemperature1791703856140
  implements MigrationInterface
{
  name = "SetAgentSettingsProviderOptionsFromTemperature1791703856140"

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      UPDATE "agent_settings"
      SET "provider_options" = CASE
        WHEN "agent_settings"."model" IN ('gemini-3.1-flash-lite', 'gemini-3.5-flash')
          THEN jsonb_build_object(
            'temperature', "agent_settings"."temperature"::float8,
            'providerOptions', derived.vertex_options
          )
        WHEN "agent_settings"."model" IN (
          'gemini-3.5-flash-lite', 'gemini-3.6-flash', 'gemini-3.7-flash', 'gemini-3.8-flash'
        )
          THEN jsonb_build_object('providerOptions', derived.vertex_options)
        ELSE jsonb_build_object('temperature', "agent_settings"."temperature"::float8)
      END
      FROM (
        SELECT
          settings.id,
          jsonb_build_object(
            'vertex', jsonb_build_object(
              'thinkingConfig', jsonb_build_object(
                'thinkingLevel', CASE
                  WHEN settings.temperature <= 0.3 THEN
                    CASE
                      WHEN settings.model IN ('gemini-3.7-flash', 'gemini-3.8-flash') THEN 'low'
                      ELSE 'minimal'
                    END
                  WHEN settings.temperature <= 0.7 THEN 'low'
                  WHEN settings.temperature <= 1.3 THEN 'medium'
                  ELSE 'high'
                END,
                'includeThoughts', true
              )
            )
          ) AS vertex_options
        FROM "agent_settings" settings
        WHERE settings.provider_options IS NULL
      ) derived
      WHERE "agent_settings".id = derived.id
    `)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`UPDATE "agent_settings" SET "provider_options" = NULL`)
  }
}
