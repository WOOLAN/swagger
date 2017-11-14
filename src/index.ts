import * as Hapi from 'hapi';
const inert = require('inert');
const vision = require('vision');
const swagger = require('hapi-swagger');

export interface IServerConfig {
    server?: Hapi.ServerOptions;
    connection?: Hapi.ServerConnectionOptions;
    api?: IAPIConfig;
}

export interface IAPIConfig {
    title?: string;
    version?: string;
    description?: string;
    contact?: string | IContact;
    redirect?: boolean;
    security?: ISecurityDefinitions;
    basePath?: string;
    documentationPath?: string;
}

export interface IContact {
    name: string;
    email?: string;
    url?: string;
}

export interface ISecurityDefinitions {
    [name: string]: ISecurity;
}

export interface ISecurity {
    type: string;
    description?: string;
    name: string;
    in: string;
    flow?: string;
    authorizationUrl?: string;
    tokenUrl?: string;
    scopes?: ISecurityScopes;
}

export interface ISecurityScopes {
    [name: string]: string;
}

export class Swagger extends Hapi.Server {
    public static extend(target: any, ...sources: any[]) {
        let source: any;

        for (let i: number = 0; i < sources.length; ++i) {
            source = sources[i];

            for (let key in source) {
                if (typeof source[key] === 'object') {
                    target[key] = this.extend(target[key] || {}, source[key]);
                } else {
                    target[key] = source[key];
                }
            }

        }

        return target;
    }

    private config: IServerConfig = {
        server: {},
        connection: {
            port: 8080
        },
        api: {
            title: 'Swagger',
            version: '1.2.0',
            description: 'Serve Swagger API',
            contact: null,
            redirect: true,
            basePath: '/api',
            documentationPath: '/apidoc'
        }
    };
    protected routes: () => Hapi.RouteConfiguration[];

    public constructor(config?: IServerConfig) {
        super(config.server);
        Swagger.extend(this.config, config);

        if (this.config.api.contact && typeof this.config.api.contact === 'string') {
            const pattern = /^([\w -]+)(?: <(.*)>(?: \((.*)\))?)?$/;
            const match = pattern.exec(this.config.api.contact);

            if (match) {
                this.config.api.contact = {
                    name: match[1]
                };

                if (match[2]) {
                    this.config.api.contact.email = match[2];
                }

                if (match[3]) {
                    this.config.api.contact.url = match[3];
                }
            }
        }

        super.connection(this.config.connection);
    }

    public run(): Promise<void> {
        return this.setup()
            .then(() => this.init())
            .then(() => this.log(['info', 'swagger'], 'Listen ' + this.info.address + ':' + this.info.port))
            .catch((err) => this.log(['error', 'swagger'], err));
    }

    private init(): Promise<Error | null> {
        this.views({
            engines: { html: require('handlebars') },
            path: __dirname + '/public'
        });

        super.route({
            method: 'GET',
            path: this.config.api.documentationPath,
            handler: (request: Hapi.Request, reply: Hapi.ReplyNoContinue) => reply.view('index.html', { path: this.config.api.documentationPath.substr(1) + '/' })
        });

        super.route({
            method: 'GET',
            path: `${this.config.api.documentationPath}/{path*}`,
            handler: {
                directory: {
                    path: __dirname + '/public',
                    listing: false,
                    index: false
                }
            }
        });

        if (this.config.api.redirect) {
            super.route({
                method: 'GET',
                path: '/',
                handler: (request: Hapi.Request, reply: Hapi.ReplyNoContinue) => reply.redirect(this.config.api.documentationPath)
            });
        }

        this.route(this.routes());

        return super.start();
    }

    public route(options: Hapi.RouteConfiguration | Hapi.RouteConfiguration[]): void {
        if (!Array.isArray(options)) {
            options = [options];
        }

        for (let i: number = 0; i < options.length; ++i) {
            if ((options[i].config as Hapi.RouteAdditionalConfigurationOptions).tags.indexOf('api') >= 0) {
                options[i].path = this.config.api.basePath + options[i].path;
            }
        }

        return super.route(options);
    }

    private setup(plugins: any[] = []): Promise<Error | null> {
        const swaggerConfig = {
            register: swagger,
            options: {
                info: {
                    title: this.config.api.title,
                    version: this.config.api.version,
                    description: this.config.api.description,
                    contact: this.config.api.contact
                },
                documentationPage: false,
                basePath: this.config.api.basePath,
                jsonPath: `${this.config.api.documentationPath}/swagger.json`,
                sortEndpoints: 'path',
                pathPrefixSize: 2,
                securityDefinitions: this.config.api.security || null
            }
        };

        return super.register([inert, vision, swaggerConfig].concat(plugins));
    }
}
