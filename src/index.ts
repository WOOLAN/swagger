import * as Hapi from 'hapi';
const inert = require('inert');
const vision = require('vision');
const swagger = require('hapi-swagger');

export interface IServerConfig {
    server?: Hapi.IServerConnectionOptions;
    api?: IAPIConfig;
}

export interface IAPIConfig {
    title?: string;
    version?: string;
    description?: string;
    contact?: string | IContact;
    redirect?: boolean;
    security?: ISecurityDefinitions;
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

export import IPromise = Hapi.IPromise;

export class Swagger extends Hapi.Server {
    private config: IServerConfig = {
        server: {
            port: 8080
        },
        api: {
            title: 'Swagger',
            version: '1.0.0',
            description: 'Serve Swagger API',
            contact: null,
            redirect: true
        }
    };
    protected routes: () => Hapi.IRouteConfiguration[];

    public constructor(config?: IServerConfig) {
        super();
        (<any> Object).assign(this.config, config); // Temp

        if (config.api.contact && typeof this.config.api.contact === 'string') {
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

        super.connection(this.config.server);
    }

    public run() {
        return this.setup()
            .then(() => this.init())
            .then(() => this.log(['info', 'swagger'], 'Listen ' + this.info.address + ':' + this.info.port))
            .catch((err) => this.log(['error', 'swagger'], err));
    }

    private init(): Hapi.IPromise<void> {
        this.views({
            engines: { html: require('handlebars') },
            path: __dirname + '/public'
        });

        super.route({
            method: 'GET',
            path: '/apidoc',
            handler: (request: Hapi.Request, reply: Hapi.IReply) => reply.view('index.html', { path: 'apidoc/' })
        });

        super.route({
            method: 'GET',
            path: '/apidoc/{path*}',
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
                handler: (request: Hapi.Request, reply: Hapi.IReply) => reply.redirect('/apidoc')
            });
        }

        super.route(this.routes());

        return super.start();
    }

    private setup(plugins: any[] = []): Hapi.IPromise<void> {
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
                basePath: '/api',
                jsonPath: '/apidoc/swagger.json',
                sortEndpoints: 'path',
                pathPrefixSize: 2,
                securityDefinitions: this.config.api.security || null
            }
        };

        return super.register([inert, vision, swaggerConfig].concat(plugins));
    }
}
