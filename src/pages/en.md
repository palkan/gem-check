# Gem Check


<div class="moto">
Help developers make other developers happier
</div>

This is the checklist for authors and maintainers of Ruby gems to help them build better open-source software.

> Ruby is designed to make programmers happy. –Matz

This document is focused **exclusively** on code aspects: API design, architecture, and documentation (because any code is useless without docs). OSS principles already have a good coverage in GitHub's [open source guide](https://opensource.guide).

## API Design

> Simple things should be simple, complex things should be possible. –Alan Kay

- [ ] Reduce boilerplate as much as possible

Compare achieving the same result with `Net::HTTP` and [HTTParty]:

```ruby
# Net::HTTP get JSON with query string
uri = URI('http://example.com/index.json')
params = { limit: 10, page: 3 }
uri.query = URI.encode_www_form(params)

res = Net::HTTP.get_response(uri)
puts JSON.parse(res.body) if res.is_a?(Net::HTTPSuccess)

# HTTParty
puts HTTParty.get('http://example.com/index.json', limit: 10, page: 3)
```

- [ ] Do not sacrifice flexibility

Do not limit the functionality only to simple cases, i.e., allow making intricate things possible.

[HTTParty], for example, still allows to control underlying HTTP engine fully:

```ruby
HTTParty.get(
  'http://example.com/index.json',
  { limit: 10, page: 3 },
  basic_auth: {},
  headers: {},
  open_timeout: 2,
  read_timeout: 3
)
```

> 80% of users use only 20% of the functionality.

- [ ] Use sensible defaults

One common pattern for sensible defaults is the [convention over configuration](https://en.wikipedia.org/wiki/Convention_over_configuration):

```ruby
class Post < ActiveRecord::Base
  # in the world with no defaults
  belongs_to :user, foreign_key: :user_id, class_name: 'User', primary_key: :id
  # and with CoC
  belongs_to :user
end
```

> Try to walk in the shoes of your users.

- [ ] Follow the [Principle of least astonishment](https://en.wikipedia.org/wiki/Principle_of_least_astonishment)

Ruby community is mature, and there are a lot of best practices. The less people think when using your library, the better.

For example, predicate methods (`smth?`) should return `true`/`false` and not something else (e.g., 0/1).
But take a look at this example from Ruby core:

```ruby
1.nonzero?
# => 1
0.nonzero?
# => nil
0.zero?
# => true
1.zero?
# => false
```

Confusing, isn't it?

Consider another example (see this [issue](https://github.com/teachbase/amorail/issues/25)):

```ruby
# Amorail is an API client
Amorail::Lead.find ANY_NONEXISTENT_ID
# => false
# why false? we're looking for an object,
# nil makes more sense when nothing is found
```

Also, check [the story](https://twitter.com/schneems/status/887433898178772996) of a confusing `retries` argument.

- [ ] Use keyword arguments if you really need more than N arguments

Where _N_ is typically equal to 2.

First, kwargs are more readable and do not depend on the order.

Secondly, kwargs [allocate less objects](https://github.com/benoittgt/understand_ruby_memory#why-keywords-arguments-will-create-less-garbage-collected-objects-after-22-answered-) compared to `options = {}` argument.

Example:

```ruby
# From influxdb-ruby

# not-good
influxdb.write_point(data, precision, retention_policy, database)

# much better
influxdb.write_point(data, precision: precision, rp: retention, db: database)
```

- [ ] Raise meaningful errors

Always provide error messages: error classes for machines, error messages for humans.

Use `ArgumentError` if a method is called with wrong or missing arguments.

Provide custom error classes for library's logic related exceptions:

```ruby
# https://github.com/influxdata/influxdb-ruby/blob/master/lib/influxdb/client/http.rb
def resolve_error(response)
  if response =~ /Couldn\'t find series/
    raise InfluxDB::SeriesNotFound, response
  end
  raise InfluxDB::Error, response
end
```

Avoid using negative words ("bad", "wrong", etc) in error messages. Use neutral words ("incorrect", "unexpected") instead.

- [ ] Monkey-patch reasonably

Avoid monkey-patching core classes. Consider using [Refinements](https://ruby-doc.org/core-2.4.1/doc/syntax/refinements_rdoc.html) instead (see, for example, [`database_rewinder`](https://github.com/amatsuda/database_rewinder/blob/v0.8.2/lib/database_rewinder/cleaner.rb)).

Patch other non-core libs using `Module#prepend` (read this exhaustive [StackOverflow answer](https://stackoverflow.com/a/4471202)).

> Make it hard to shoot yourself in the foot.

- [ ] Encourage developers to avoid dangerous behavior

For example, [Minitest] uses long and shaming method name to disable random order for tests (` #i_suck_and_my_tests_are_order_dependent!`).

Another great idea is to show flashy warnings. Consider this [Sidekiq] example:

```ruby
if defined?(::Rails) && Rails.respond_to?(:env) && !Rails.env.test?
  puts('**************************************************')
  puts("⛔️ WARNING: Sidekiq testing API enabled,
    but this is not the test environment.
    Your jobs will not go to Redis.")
  puts('**************************************************')
end
```

## Codebase

> Code is written once but read many times.

- [ ] Write code in style

Your code should have _consistent_ style (i.e. naming, formatting, etc.).
And it would be great to respect [the community's style](https://github.com/bbatsov/ruby-style-guide).

Compare the following two snippets:

<span style="display:none;"># rubocop:disable all</span>
```ruby
def some_kinda_fun a, even = false
  x = if even then a+1 else a end
  {:x => a, :y => x}
end

def some_kinda_fun(a, even: false)
  x = even ? a + 1 : a
  { x: a, y: x }
end
```
<span style="display:none;"># rubocop:enable all</span>

Which one is more readable?

- [ ] Cover code with tests

Coverage makes sense for libraries.

But readable test cases make even more sense, especially in integration scenarios (because such tests can be used as documentation).

## Architecture

> Write code for others, not for yourself.

- [ ] Adapterize third-party dependencies

For example, [Active Job] is a great abstraction for background jobs: it supports different adapters, and it's easy to build your own.

On the other hand, [Action Cable] code is tightly coupled with its server implementation. That makes other WebSocket servers impossible to use without a fair amount of monkey-patching (at least, unless [some refactoring](https://github.com/rails/rails/pull/27648) is done).

Whenever you write a library for a particular database, framework, or something else, think beforehand if it is going to work with alternatives.

- [ ] Keep extensibility in mind

There are different ways to build extensible libraries, e.g., by providing _middleware_ (like [Rack], [Faraday] and [Sidekiq])
or _plugin_ (like [Shrine] and [Devise]) functionality.

The key idea here is to provide an ability to extend functionality by avoiding patching or high coupling.

- [ ] Provide logging functionality (when necessary)

Logging helps people to identify problems but should be _controllable_ (severity levels, custom outputs, (possibly) filtering).

The easiest way to provide flexible logging is to allow users to specify the Logger instance themselves:

```ruby
GemCheck.logger = Logger.new(STDOUT)
```

Avoid `puts` logging.

- [ ] Make code testable

Help developers to easily test the code that uses your library: provide custom matchers (like [Pundit](https://github.com/elabs/pundit#rspec)), testing adapters (like [Active Job](http://edgeguides.rubyonrails.org/active_job_basics.html#job-testing)), or mocks (like [Fog](https://github.com/fog/fog#mocks)).

Ensure your code can be configured to be less computational-heavy in tests, like [Devise] does:

```ruby
Devise.setup do |config|
  config.stretches = Rails.env.test? ? 1 : 11
end
```

- [ ] Make configuration flexible

Provide different ways to configure your library: _manually_ through the code, from YAML files, or from environmental variables.
See, for example, [`aws-sdk`](https://github.com/aws/aws-sdk-ruby#configuration).

Integration libraries **must** support [_twelve-factor-able_](https://12factor.net) configuration. You can use [anyway_config] to accomplish this.

Use sensible defaults for configuration (e.g., for Redis connection it's good to use `localhost:6379` by default) and environment variables names (e.g., `REDIS_URL` for Redis, like [Sidekiq](https://github.com/mperham/sidekiq/blob/v5.0.0/lib/sidekiq/redis_connection.rb#L100-L102) does).

- [ ] Manage runtime dependencies carefully

More dependencies–more chances for failure, harder upgrades.

You don't need the whole `rails` if you're only using `active_model`.
You don't need the whole `active_support` if you only need a couple of patches (consider using ad-hoc refinements instead).

Do not add library that is only used in some use cases as a dependency (e.g., Rails does not add `redis` as a default dependency, it only suggests that you may add it yourself).

Monitor your dependencies for CVE (see [bundler-audit](https://github.com/rubysec/bundler-audit)) or let [DependencyCI](https://dependencyci.com) do all the work for you.

- [ ] Provide interoperability (if it is possible)

There is more than one major [Ruby implementation](https://en.wikipedia.org/wiki/Ruby_(programming_language)#Alternate_implementations), and at least three popular: MRI, [JRuby](http://jruby.org) and [Rubinius](https://rubinius.com) (and [TruffleRuby](https://github.com/graalvm/truffleruby) is coming). The fact that MRI is much more popular than others does not mean you should ditch the rest.

[Concurrent Ruby](https://github.com/ruby-concurrency/concurrent-ruby) is an excellent example of interoperability.

You should at least provide the information whether other platforms are supported or not (just add them to your CI and check–that's easy!).

## Documents

> A program is only as good as its documentation. –Joe Armstrong

- [ ] Provide at least one form of documentation

It is not always necessary to write a book, or even RDocs: _well-written_ Readme could be sufficient (see [awesome-readme](https://github.com/matiassingers/awesome-readme) for examples).

_Provide benchmarks_ in any form if your library is more performant than others (at least, tell users how much memory/CPU/time can be saved with your solution).

- [ ] Write docs in style

Your documentation contains a lot of code examples? Make sure their have correct syntax and consistent style.
For example, for Ruby snippets you can use [`rubocop-md`](https://github.com/palkan/rubocop-md).

And don't forget about the language! We use [yaspeller-ci](https://github.com/ai/yaspeller-ci) for that.

- [ ] Provide examples for both simple and complex scenarios

A good example is much better than documentation.

Provide code snippets, Wiki pages for specific scenarios–just show people how you are using your own code!

- [ ] Explain how you wrote the code

There are several reasons for that: sharing knowledge and helping others to contribute and debug potential problems easily.

See this great example from [rbspy](https://github.com/rbspy/rbspy/blob/master/ARCHITECTURE.md).


- [ ] Show the current state of the project

It should be clear to users what is the current state of the project and which versions of software (the language itself, dependencies) are supported (you can use badges in your Readme).

- [ ] Use semantic versioning

[SemVer](http://semver.org) helps your users to easily upgrade without thinking about breaking changes.

- [ ] Use deprecation messages prior to introducing breaking changes

See, for example, how [Rails](https://github.com/rails/rails/blob/v5.2.0.beta2/railties/lib/rails/commands/server/server_command.rb#L29) do that.

- [ ] Keep a changelog

Wondering why? Just read the [keepchangelog.com](http://keepachangelog.com/en/1.0.0/).

Looking for an automation? Take a look at [`github-changelog-generator`](https://github.com/skywinder/github-changelog-generator) and [`loglive`](https://github.com/egoist/loglive).

Your commits history is also a kind of changelog, so, use meaningful messages ([`git-cop`](https://github.com/bkuhlmann/git-cop) can help you with it).

- [ ] Provide upgrade notes

See, for example, [Hanami](http://hanamirb.org/guides/1.1/upgrade-notes/v100/).

## Misc

> OSS that stops evolution gradually dies. –Matz

- [ ] Keep code up to date with related technologies

Try to prevent compatibility issues by monitoring dependencies upgrades ([Depfu] could help here).

Run your tests against `ruby-head`, Rails `master`, whatever–just add it to your CI, it's easy!

- [ ] Make development process less painful

Sooner or later people will try to contribute to your work. Is your development process transparent, or does it require a lot of effort to setup?

For example, Rails has a [`rails-dev-box`](https://github.com/rails/rails-dev-box) to help you start developing easily.

[Docker](https://www.docker.com) is also a good way to make dependency management simpler.

- [ ] Update your version on RubyGems in time

Keep version of a gem at [RubyGems](https://rubygems.org/) up-to-date with your main repository releases.

When should I bump a version?

<div class="nested-list">

- Security fix
- Fixing a regression bug (like [Ruby 2.3.3](https://www.ruby-lang.org/en/news/2016/11/21/ruby-2-3-3-released/))
- Adding a feature – wait for next planned release
- Fixing a bug that was there for a long time – wait for next planned release

</div>

It's a good practice to publish RC/beta versions prior to releasing a major update.

You can automate your release process by using, for example, [`gemsmith`](https://github.com/bkuhlmann/gemsmith) / [`gem-release`](https://github.com/svenfuchs/gem-release) or CI services (e.g. [Travis supports](https://docs.travis-ci.com/user/deployment/rubygems/) RubyGems deployments).

[HTTParty]: https://github.com/jnunemaker/httparty
[Active Job]: http://edgeguides.rubyonrails.org/active_job_basics.html
[Action Cable]: http://edgeguides.rubyonrails.org/action_cable_overview.html
[Rack]: https://github.com/rack/rack
[Faraday]: https://github.com/lostisland/faraday
[Sidekiq]: https://github.com/mperham/sidekiq
[Shrine]: https://github.com/janko-m/shrine
[Devise]: https://github.com/plataformatec/devise
[anyway_config]: https://github.com/palkan/anyway_config
[Minitest]: https://github.com/seattlerb/minitest
[Depfu]: https://depfu.io
