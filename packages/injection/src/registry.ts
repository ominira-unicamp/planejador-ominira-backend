import type { InjectionDefinition } from "./config.js";
import {
    injectAcademicData,
    type AcademicDataInjectionOptions
} from "./services/AcademicDataInjection.js";
import {
    injectCalendar,
    type CalendarInjectionOptions
} from "./services/CalendarInjection.js";
import {
    injectCatalogDisciplines,
    type CatalogDisciplinesInjectionOptions
} from "./services/CatalogDisciplinesInjection.js";
import {
    injectCatalogs,
    type CatalogInjectionOptions
} from "./services/CatalogInjection.js";
import type { InjectionContext } from "./services/InjectionTypes.js";
import {
    injectSuggestions,
    type SuggestionsInjectionOptions
} from "./services/SuggestionsInjection.js";

export type InjectionService = {
    run(context: InjectionContext): Promise<void>;
};

type InjectionOptions = Record<string, unknown>;

function createService<TOptions extends InjectionOptions>(
    fn: (context: InjectionContext, options: TOptions) => Promise<void>,
    options: InjectionOptions
): InjectionService {
    return { run: (context) => fn(context, options as TOptions) };
}

const services: Record<
    string,
    (options: InjectionOptions) => InjectionService
> = {
    "academic-data": (options) =>
        createService(
            injectAcademicData,
            options as AcademicDataInjectionOptions & InjectionOptions
        ),
    "calendar": (options) =>
        createService(
            injectCalendar,
            options as CalendarInjectionOptions & InjectionOptions
        ),
    "catalogs": (options) =>
        createService(
            injectCatalogs,
            options as CatalogInjectionOptions & InjectionOptions
        ),
    "catalog-disciplines": (options) =>
        createService(
            injectCatalogDisciplines,
            options as CatalogDisciplinesInjectionOptions & InjectionOptions
        ),
    "suggestions": (options) =>
        createService(
            injectSuggestions,
            options as SuggestionsInjectionOptions & InjectionOptions
        )
};

export const injectionNames = Object.keys(services);

export function createInjectionService(definition: InjectionDefinition) {
    const factory = services[definition.name];
    if (!factory)
        throw new Error(
            `Injection predefinida não encontrada: ${definition.name}`
        );
    return factory(definition.options);
}
